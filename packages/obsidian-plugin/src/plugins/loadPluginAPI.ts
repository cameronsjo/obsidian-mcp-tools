import { firstValueFrom, interval, map, filter } from "rxjs";

/**
 * Obsidian plugins may expose their public API at an arbitrary time. Loads a plugin API by repeatedly calling the provided getter function until a non-undefined value is returned, or the maximum number of retries is reached.
 * @param getter - A function that returns the plugin API or undefined.
 * @param options - An optional object with the following properties:
 *   - retries - The maximum number of times to retry calling the getter function (default is 10).
 *   - interval - The time in milliseconds to wait between each retry (default is 500).
 * @returns A function that, when called, returns a Promise that resolves to the plugin API or undefined.
 */

export const loadPluginAPI = <Args extends Array<unknown>, T>(
	getter: (...args: Args) => T | undefined,
	{
		retries = 10, interval: ms = 500,
	}: { retries?: number; interval?: number; } = {}
) => (...args: Parameters<typeof getter>): Promise<T | undefined> => {
	return firstValueFrom(
		interval(ms).pipe(
			map(() => getter(...args)),
			filter((api, i) => !!api || i >= retries)
		)
	);
};
