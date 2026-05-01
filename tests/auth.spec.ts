import { test, expect } from '@playwright/test';

test.describe('Autenticação e Login', () => {
  test('Deve carregar a tela de login e exibir botão do Google', async ({ page }) => {
    // Acessa a raiz do sistema (deve redirecionar para /login se não autenticado)
    await page.goto('/');
    
    // Verifica se a URL mudou para /login
    await expect(page).toHaveURL(/.*\/login/);

    // Verifica se o botão de login com Google existe
    const googleLoginButton = page.getByRole('button', { name: /entrar com google/i });
    await expect(googleLoginButton).toBeVisible();
    
    // Verifica se o título do sistema existe
    const title = page.getByRole('heading', { name: /saúde\+ escalas/i });
    await expect(title).toBeVisible();
  });
});
