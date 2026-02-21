import {
  chooseBestPriceEvidence,
  estimateLineCostFromUnitPrice,
  finalizePricingFromEvidence,
  type ItemPriceEvidence,
} from '../ai/pricing';

describe('chooseBestPriceEvidence', () => {
  it('prioritizes recent receipt price over online sources', () => {
    const evidence: ItemPriceEvidence = {
      receiptUnitPrice: 2.5,
      wincoUnitPrice: 2.2,
      onlineUnitPrice: 2.3,
    };

    expect(chooseBestPriceEvidence(evidence)).toEqual({
      unitPrice: 2.5,
      source: 'receipt',
    });
  });

  it('falls back to winco when receipt is unavailable', () => {
    const evidence: ItemPriceEvidence = {
      receiptUnitPrice: undefined,
      wincoUnitPrice: 3.1,
      onlineUnitPrice: 3.4,
    };

    expect(chooseBestPriceEvidence(evidence)).toEqual({
      unitPrice: 3.1,
      source: 'winco',
    });
  });
});

describe('estimateLineCostFromUnitPrice', () => {
  it('uses unit price directly when quantity is unknown', () => {
    expect(estimateLineCostFromUnitPrice(2.49, undefined, undefined)).toBe(2.49);
  });

  it('scales count units by quantity', () => {
    expect(estimateLineCostFromUnitPrice(1.5, 3, 'ea')).toBe(4.5);
  });
});

describe('finalizePricingFromEvidence', () => {
  it('totals estimated costs and tags sources', () => {
    const result = finalizePricingFromEvidence([
      {
        itemName: 'Milk',
        quantity: 1,
        unit: 'gallon',
        evidence: {
          receiptUnitPrice: 3.29,
        },
      },
      {
        itemName: 'Onion',
        quantity: 2,
        unit: 'lb',
        evidence: {
          wincoUnitPrice: 0.99,
        },
      },
    ]);

    expect(result.items).toMatchObject([
      {
        itemName: 'Milk',
        unitPrice: 3.29,
        estimatedCost: 3.29,
        source: 'receipt',
      },
      {
        itemName: 'Onion',
        unitPrice: 0.99,
        estimatedCost: 1.98,
        source: 'winco',
      },
    ]);
    expect(result.totalEstimatedCost).toBe(5.27);
  });
});
