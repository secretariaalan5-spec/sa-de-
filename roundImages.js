import Jimp from 'jimp';

async function makeCircle(imagePath, outputPath) {
  try {
    const image = await Jimp.read(imagePath);
    const radius = Math.min(image.bitmap.width, image.bitmap.height) / 2;
    const circleMask = new Jimp(image.bitmap.width, image.bitmap.height, 0x00000000);

    circleMask.scan(0, 0, circleMask.bitmap.width, circleMask.bitmap.height, function (x, y, idx) {
      const distance = Math.sqrt(Math.pow(x - radius, 2) + Math.pow(y - radius, 2));
      if (distance <= radius) {
        this.bitmap.data[idx + 3] = 255;
      }
    });

    image.mask(circleMask, 0, 0);
    await image.writeAsync(outputPath);
    console.log('Successfully created round logo:', outputPath);
  } catch (err) {
    console.error('Error creating circular logo:', err);
  }
}

makeCircle('./public/logo-saude.png', './public/logo-saude-round.png');
