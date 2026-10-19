import { getCurrencyIconSvg } from "./currency-icons";

const iconCache = new Map<string, HTMLImageElement>();
let logoCache: HTMLImageElement | null | undefined;

/** Loads an SVG string into an image, revoking the temporary object URL either way. */
function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg load"));
    };
    image.src = url;
  });
}

/**
 * Loads the logo, currency icons and Space Grotesk before drawing; canvas text silently falls back otherwise.
 * Results are cached at module level (logo: null = failed, undefined = not tried yet).
 */
export async function preloadCardAssets(currencies: string[]): Promise<{
  logoImage: HTMLImageElement | null;
  iconMap: Map<string, HTMLImageElement>;
}> {
  const logoPromise: Promise<HTMLImageElement | null> =
    logoCache !== undefined
      ? Promise.resolve(logoCache)
      : new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            logoCache = image;
            resolve(image);
          };
          image.onerror = () => {
            logoCache = null;
            resolve(null);
          };
          image.src = "/logo.webp";
        });

  const unique = [...new Set(currencies)];
  const iconPromises = unique.map(
    async (currencyCode): Promise<[string, HTMLImageElement] | null> => {
      if (iconCache.has(currencyCode)) return [currencyCode, iconCache.get(currencyCode)!];
      try {
        const image = await svgToImage(getCurrencyIconSvg(currencyCode));
        iconCache.set(currencyCode, image);
        return [currencyCode, image];
      } catch {
        return null;
      }
    },
  );

  const fontPromise = document.fonts
    ? Promise.all([
        document.fonts.load('7px "Space Grotesk"'),
        document.fonts.load('bold 12px "Space Grotesk"'),
        document.fonts.load('bold 20px "Space Grotesk"'),
      ]).catch(() => null)
    : Promise.resolve(null);

  const [logoImage, ...iconResults] = await Promise.all([
    logoPromise,
    fontPromise,
    ...iconPromises,
  ]);
  const iconMap = new Map<string, HTMLImageElement>();
  for (const result of iconResults) {
    if (result && Array.isArray(result))
      iconMap.set(
        (result as [string, HTMLImageElement])[0],
        (result as [string, HTMLImageElement])[1],
      );
  }
  return { logoImage: logoImage, iconMap };
}
