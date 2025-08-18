import { test } from '../../config/LoginSetup';
import { LoginAction } from '../Login/login.actions';

test('login test', async ({ context }) => {
  const page = await context.newPage();
  const loginAction = new LoginAction(page);

  await test.step('Sign in with Microsoft', async () => {
    await loginAction.login();
  });
});