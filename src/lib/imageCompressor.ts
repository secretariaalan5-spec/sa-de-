/**
 * Redimensiona e comprime uma imagem no próprio navegador para 300x300 WebP ou JPEG.
 * Isso garante que o upload seja instantâneo (menos de 50 KB) e economize
 * 100% da cota gratuita do Supabase Storage.
 */
export async function compressAvatarImage(file: File, maxSize = 300, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida ou corrompida'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Corte quadrado centralizado (para avatar circular perfeito)
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Falha ao obter contexto 2D do Canvas'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          img,
          startX,
          startY,
          minDim,
          minDim,
          0,
          0,
          maxSize,
          maxSize
        );

        // Prefere WebP se suportado, senão JPEG
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Erro na compressão da imagem'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
