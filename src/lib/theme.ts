/** localStorage key for the user's theme choice ("light" | "dark"). */
export const THEME_KEY = "afa:theme";

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
