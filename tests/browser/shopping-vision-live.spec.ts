import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { AgentLedger, configuredAgentBudget } from '../../src/server/agents/ledger';
import { withAgentUsage } from '../../src/server/agents/usage';
import { reviewProductPhotos } from '../../src/server/agents/shopping-vision';

test('live visual review retains a matching shoe and rejects its opposite colorway', async ({}, testInfo) => {
  test.skip(
    process.env.LIVE_VISUAL_SHOPPING !== 'true' || !process.env.LIVE_EXACT_ITEM_PHOTO,
    'Opt-in one metered visual comparison against documented official product photos.',
  );
  test.setTimeout(90000);
  loadEnvConfig(process.cwd());
  const db = new PrismaClient();
  const user = await db.user.create({
    data: {
      username: 'qa_vision_' + randomBytes(7).toString('hex'),
      passwordHash: 'disabled',
      recoveryHash: 'disabled',
    },
  });
  const ledger = new AgentLedger(db, configuredAgentBudget());
  let requestId: string | undefined;
  try {
    const record = (
      await ledger.reserve(user.id, 'visual-' + randomBytes(12).toString('hex'), {
        agent: 'shop',
        detectionId: 'evaluation',
        itemIndex: 0,
        country: 'US',
      })
    ).request;
    requestId = record.id;
    expect(await ledger.claim(user.id, record.id)).toBe(true);
    const assetUrls = [
      'https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Samba_OG_Shoes_White_B75806_01_00_standard.jpg',
      'https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/4c70105150234ac4b948a8bf01187e0c_9366/Samba_OG_Shoes_Black_B75807_01_standard.jpg',
    ];
    const listings = assetUrls.map((imageUrl, index) => ({
      title: 'Candidate ' + (index + 1),
      url: 'https://www.adidas.com/us/samba-og-shoes/' + (index ? 'B75807' : 'B75806') + '.html',
      retailer: 'adidas.com',
      reason: 'Evaluation candidate',
      match: 'similar' as const,
      evidence: {
        sourceUrl:
          'https://www.adidas.com/us/samba-og-shoes/' + (index ? 'B75807' : 'B75806') + '.html',
        availability: 'unknown' as const,
        checkedAt: new Date().toISOString(),
        note: 'Controlled evaluation fixture; product URLs independently documented.',
        imageUrl,
      },
    }));
    const start = Date.now();
    const result = await withAgentUsage(user.id, record.id, () =>
      reviewProductPhotos(
        {
          name: 'Low-top shoe',
          category: 'shoes',
          color: '#ffffff',
          description: 'White shoe with black side stripes, grey toe overlay and brown sole.',
          visibleBrand: null,
          uncertainty: '',
          readableText: [],
          visibleModelCode: null,
        },
        listings,
        {
          data: new Uint8Array(require('node:fs').readFileSync(process.env.LIVE_EXACT_ITEM_PHOTO!)),
          mimeType: 'image/jpeg',
        },
      ),
    );
    if (result.cost === null) {
      await db.agentRequest.update({
        where: { id: record.id },
        data: {
          state: 'uncertain',
          result: { listings: result.listings, generationCount: result.generationCount },
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      });
    } else {
      await ledger.settle(user.id, record.id, {
        state: 'succeeded',
        actualMicros: result.cost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        result: { listings: result.listings, generationCount: result.generationCount },
      });
    }
    const report = {
      case: 'white-vs-black-samba-visual',
      elapsedMs: Date.now() - start,
      ...result,
    };
    console.log(JSON.stringify(report));
    await testInfo.attach('visual-review-evaluation', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    expect(
      result.generationCount,
      'Retailer images must actually reach visual comparison for this test to count',
    ).toBe(1);
    expect(
      result.listings.find((listing) => listing.url.includes('B75806'))?.visualReview?.status,
    ).toBe('consistent');
    expect(result.listings.some((listing) => listing.url.includes('B75807'))).toBe(false);
    expect(result.listings.every((listing) => listing.identityEvidence === 'unverified')).toBe(
      true,
    );
  } catch (error) {
    if (requestId) await ledger.markUncertain(user.id, requestId);
    throw error;
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
