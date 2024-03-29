import React from 'react';
import express from 'express';
import compress from 'compression';
import Helmet from 'react-helmet';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { sessionService } from 'redux-react-session';
import { matchRoutes } from 'react-router-config';
import { IntlProvider } from 'react-intl';
import serialize from 'serialize-javascript';
import { ServerStyleSheet } from 'styled-components';

import locales from 'locales';
import configureStore from 'store/configureStore.prod';
import routesPaths from 'constants/routesPaths';
import { applyQueryParams } from 'utils/helpers';
import App from './_app';
import routes from '../src/routes';
import Doc from './_document';
import { getLanguageFromHeader } from './helpers';

const assets = require('./build/assets.json'); // eslint-disable-line import/no-unresolved

const server = express();

const cacheTime = 31536000;

server
  .disable('x-powered-by')
  .use(compress())
  .use(express.static(
    'server/build/public',
    {
      maxAge: cacheTime,
      setHeaders: (res, path) => {
        if (/main-sw.js/.test(path)) {
          res.setHeader('Cache-Control', 'public, max-age=0');
        }
      }
    },
  ))
  .get('*', async (req, res) => {
    try {
      const store = configureStore();
      const context = {};

      try {
        await sessionService.initServerSession(store, req);
      } catch (err) {}

      // Fetch data promises
      const promises = matchRoutes(routes, req.path)
        .map(({ route }) => (route.component.loadData ? route.component.loadData(store) : null))
        .map((promise) => {
          if (promise) {
            return new Promise((resolve) => {
              promise.then(resolve).catch(resolve);
            });
          }
        });

      // Set INTL locale and messages
      const userLocale = getLanguageFromHeader(req.get('Accept-Language'));
      const messages = locales[userLocale];

      Promise.all(promises).then(async () => {
        const renderPage = () => {
          const staticRouter = (
            <IntlProvider
              locale={userLocale}
              messages={messages}
              defaultLocale="en"
            >
              <Provider store={store}>
                <StaticRouter location={req.url} context={context}>
                  <App routes={routes} />
                </StaticRouter>
              </Provider>
            </IntlProvider>
          );
          const sheet = new ServerStyleSheet();
          const html = ReactDOMServer.renderToString(sheet.collectStyles(staticRouter));
          const styleTags = sheet.getStyleElement();
          const helmet = Helmet.renderStatic();
          const preloadedState = serialize(store.getState());
          return { html, helmet, styleTags, preloadedState };
        };

        const { html, helmet, styleTags, preloadedState } = renderPage();

        // Redirect
        if (context.url) {
          let queryRedirect;
          if (req.url !== routesPaths.index) {
            queryRedirect = { from: req.url };
          }
          res.writeHead(302, {
            Location: applyQueryParams(context.url, queryRedirect)
          });
          res.end();
        } else {
          if (context.status) {
            res.status(context.status);
          }
          const docProps = { helmet, assets, styleTags, preloadedState };
          const doc = ReactDOMServer.renderToStaticMarkup(<Doc {...docProps} />);
          res.send(`<!doctype html> ${doc.replace('SSR_MARKUP', html)}`);
        }
      });
    } catch (error) {
      res.json(error);
    }
  });

export default server;
