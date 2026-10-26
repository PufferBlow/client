import { join, normalize, sep } from "path";

/**
 * The installed app serves its own files from `app://pufferblow/` instead of opening `index.html` from disk.
 * The page is built for a web server: its scripts are at `/assets/...` and its routes are real paths such as
 * `/dashboard`, neither of which a `file://` address can do.
 */
export const APP_SCHEME = "app";
export const APP_URL = `${APP_SCHEME}://pufferblow/`;

/**
 * Which file under `root` an address asks for. A real file is served as it is; a route (anything that is not a file)
 * gets the page, so a reload on `/dashboard` still lands in the app. Nothing outside `root` is ever returned.
 */
export function resolveAppFile(root: string, pathname: string, isFile: (path: string) => boolean): string {
  const index = join(root, "index.html");
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return index;
  }
  const file = normalize(join(root, decoded));
  if (file !== root && !file.startsWith(root + sep)) return index;
  return isFile(file) ? file : index;
}
