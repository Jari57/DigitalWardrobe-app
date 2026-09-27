import { test, expect, chromium } from '@playwright/test';
import { mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import * as auth from '../../src/server/auth';
import * as overview from '../../src/server/admin-overview';
import Admin from '../../src/app/admin/page';

// Playwright transforms imported JSX into serializable elements; revive only this test fixture for React SSR.
function revive(value: any): any {
  if (Array.isArray(value)) return value.map(revive);
  if (value && value.__pw_type) {
    const Type =
      typeof value.type === 'function' ? (props: any) => revive(value.type(props)) : value.type;
    return createElement(
      Type,
      { ...value.props, key: value.key },
      ...(Array.isArray(value.props.children)
        ? value.props.children.map(revive)
        : [revive(value.props.children)]),
    );
  }
  return value;
}

test('owner dashboard renders real component layout at desktop/mobile widths and guards access before loading data', async () => {
  let role = 'visitor',
    calls = 0;
  mock.method(auth, 'sessionUser', async () =>
    role === 'visitor'
      ? null
      : { id: 'fixture', username: 'Owner fixture', isAdmin: role === 'admin' },
  );
  mock.method(overview, 'adminOverview', async () => {
    calls++;
    return {
      users: 12,
      newUsers: 3,
      garments: 25,
      outfits: 6,
      traffic: [
        {
          day: '2026-09-27',
          page: '/',
          channel: 'social',
          device: 'mobile',
          signedIn: false,
          views: 24,
        },
      ],
      actions: [{ event: 'visit', _sum: { count: 6 } }],
      agents: [{ agent: 'shop', state: 'succeeded', count: 4, cost: 12000, tokens: 530 }],
      recent: [],
      people: [
        {
          id: 'fixture',
          username: 'Demo account',
          createdAt: new Date('2026-09-27'),
          lastActive: '2026-09-27',
          requests: 4,
          spend: 12000,
        },
      ],
      budget: { spentMicros: 12000, heldMicros: 0 },
      refresh: { lastSuccess: new Date('2026-09-27'), failedSources: [] },
      control: { aiPaused: false, dailyCapMicros: null, requestsPerUser: null, version: 0 },
      audit: [],
      shopping: { searches: 4, withResults: 3, photos: 5, listings: 6, exact: 0 },
      active: { active: 6, returning: 2 },
      today: '2026-09-27',
      since: '2026-08-29',
    };
  });
  const env = { ...process.env };
  process.env.AI_ENABLED = 'true';
  process.env.AI_DAILY_CAP_MICROS = '1000000';
  process.env.AI_MAX_REQUEST_MICROS = '100000';
  try {
    await expect(Admin({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    role = 'user';
    await expect(Admin({ searchParams: Promise.resolve({}) })).rejects.toThrow('404');
    expect(calls).toBe(0);
    role = 'admin';
    const markup = renderToStaticMarkup(
      createElement(
        AppRouterContext.Provider,
        { value: { refresh() {} } as AppRouterInstance },
        revive(await Admin({ searchParams: Promise.resolve({}) })),
      ),
    );
    const css = (
      await Promise.all(
        ['globals.css', 'themes.css', 'responsive.css', 'editorial.css', 'admin/admin.css'].map(
          (file) => readFile('src/app/' + file, 'utf8'),
        ),
      )
    ).join('\n');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(
        `<html><head><style>*{box-sizing:border-box}body{margin:0;background:#f5f4ef;font-family:Arial,sans-serif}${css}</style></head><body>${markup}</body></html>`,
      );
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.getByRole('heading', { name: 'Control room.' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save controls' })).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await page.screenshot({ path: `../outputs/admin-fixture-${width}.png`, fullPage: true });
      }
      await page.locator('html').evaluate((el) => el.setAttribute('data-theme', 'dark'));
      await expect(page.locator('.admin-room')).toHaveCSS('color', 'rgb(239, 237, 231)');
      await page.screenshot({ path: '../outputs/admin-fixture-dark.png', fullPage: true });
    } finally {
      await browser.close();
    }
  } finally {
    mock.restoreAll();
    process.env = env;
  }
});
