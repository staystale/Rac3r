// menu.ts — MAIN MENU, TEST MODE (track select -> match setup) and the GARAGE (user spec,
// SPECS-.md "UI / UX"). DOM, not canvas: lists, scrolling and taps are what the DOM is
// for, and the game canvas keeps running the DEMO LAP behind it (user's choice). Pixel-art UI
// style: hard 2 px outlines, square corners, hard drop shadows, the HUD's colour table (green = go
// / interactive, amber = highlight, red = locked / danger). Everything a screen shows is READ LIVE:
// car numbers come from src/carstats.js (measured by tools/carstats.mjs, rule 10), track pictures
// from the real level painter.
//
// main.js owns the game; this file only asks it to do things through `api`: api.thumbs -> {
// levelId: canvas } (painted once, cached) api.launch(level, car) start a Test Mode session
// api.carSprite(id) -> canvas of the generated pixel car
import { CSS } from './menu/style.ts';
import { loadProfile } from './menu/profile.ts';
import { showMainMenu } from './menu/tracks.js';
import { showPause, showResults } from './menu/race.js';
import type { Profile, Livery } from './menu/profile.ts';
import type { Spec } from './cars.ts';
import type { Level } from './world/types.ts';

/** What main.js offers the menu. */
export interface MenuApi {
  thumbs: () => Record<string, HTMLCanvasElement>;   // the level thumbnails, painted once
  launch: (levelId: string, carId: string, opts?: Record<string, unknown>) => void;   // a session
  daytime: boolean;   // the clock runs (setup shows the time rows)
  genStage: (options: Record<string, unknown>) => Level;   // a generated stage, installed
  // a car's pixel sprite: by id (with a livery) or from a spec (with its wheels or not)
  carSprite: (car: string | Spec, livery?: Livery, wheels?: boolean) => { c: HTMLCanvasElement };
}

/** The menu context every screen shares. */
export interface Menu {
  api: MenuApi;
  root: HTMLElement;
  profile: Profile;
  thumbs: Record<string, HTMLCanvasElement> | null;   // the cached level thumbnails
  openedAt: number;   // when the current screen opened (ghost-click guard)
}

/**
 * Closes the menu: hides the root and empties it.
 * @param menu the menu context
 */
export function hideMenu(menu: Menu): void {
  menu.root.className = 'gone';
  menu.root.innerHTML = '';
}

/**
 * Opens the menu on the main screen.
 * @param menu the menu context
 */
export function showMenu(menu: Menu): void {
  menu.root.className = '';
  showMainMenu(menu);
}

/**
 * Creates the menu: injects its style and root element, builds the context object shared by the
 * screens and returns the menu's public methods.
 * @param api what main.js offers (thumbs, launch, carSprite, genStage)
 * @returns { show, hide, pause, results, profile, open }
 */
export function createMenu(api: MenuApi) {
  const profile = loadProfile();
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  const root = document.createElement('div');
  root.id = 'menu';
  root.className = 'gone';
  document.body.appendChild(root);
  const menu: Menu = {
    api,
    root,
    profile,
    thumbs: null,   // the cached level thumbnails
    openedAt: 0,   // when the current screen opened (ghost-click guard)
  };
  return {
    show: () => showMenu(menu),
    hide: () => hideMenu(menu),
    pause: (act: object) => showPause(menu, act),
    results: (flow: object, act: object) => showResults(menu, flow, act),
    profile,
    get open() {
      return root.className !== 'gone';
    },
  };
}
