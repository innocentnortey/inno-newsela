import Decimal from "decimal.js";
import { InvariantViolation } from "@ls/core/errors";
import type { ModelPrice } from "@ls/core/ports/common";

export interface PriceTable {
  prices: ModelPrice[];
  confirmed_on: string;
  price_for(model_id: string): ModelPrice;
}

const PRICES: ModelPrice[] = [
  {
    model_id: "claude-sonnet-5-5",
    input_per_mtok: new Decimal("2.00"),
    output_per_mtok: new Decimal("10.00"),
    cache_read_per_mtok: new Decimal("0.20"),
    cache_write_per_mtok: new Decimal("2.50"),
  },
];

export const PRICE_TABLE: PriceTable = {
  prices: PRICES,
  confirmed_on: "2026-10-25",
  price_for(model_id: string): ModelPrice {
    const found = PRICES.find((p) => p.model_id === model_id);
    if (found === undefined) throw new InvariantViolation("no price for " + model_id);
    return found;
  },
};
