describe('Home Page', () => {
  beforeEach(() => {
    cy.mockResponse('DELETE', '**/users/sign_out', {}, 'logoutStub');

    cy.fixture('userData.json').as('user').then(({ user }) => {
      cy.fixture('respHeader.json').as('session').then((session) => {
        cy.logUser(user, session);
        cy.fetchVisit('/');
      });
    });
  });

  context('Homepage View', () => {
    it('displays a welcome message', () => {
      cy.get('p').contains('Welcome to React Redux Base');
    });

    it('should see the logged out button', () => {
      cy.get('button').contains('LOGOUT');
    });

    it('click in the logout button,should be redirected to the login path', () => {
      cy.get('button').click().then(() => cy.url().should('match', /login/));
    });
  });
});
