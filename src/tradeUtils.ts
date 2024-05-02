import type { PaginatedCoins } from "@mysten/sui.js/client";
import { SuiKit } from "@scallop-io/sui-kit";
import { coins, CoinType } from "./coinTypes";

export const getAllPairs = (coinTypes: CoinType[]): [CoinType, CoinType][] => {
  const pairs: [CoinType, CoinType][] = [];
  for (let i = 0; i < coinTypes.length; i++) {
    for (let j = 0; j < coinTypes.length; j++) {
      if (i !== j) {
        pairs.push([coinTypes[i], coinTypes[j]]);
      }
    }
  }
  return pairs;
};

export const formatCoinAmount = (coinType: CoinType, amount: bigint): string => {
  const decimals = coins[coinType].decimal;
  const floatAmount = Number(amount) / 10 ** decimals;
  return floatAmount.toFixed(decimals);
}

export const getAllCoin = async (suiKit: SuiKit, owner: string, coinType: string) => {
  const coins: PaginatedCoins["data"] = [];

  let hasNext = true,
    nextCursor: string | null | undefined = undefined;

  while (hasNext) {
    const resp = await suiKit.client().getCoins({
      owner: owner,
      coinType: coinType,
      cursor: nextCursor,
    });
    coins.push(...resp.data);

    nextCursor = resp.nextCursor;
    hasNext = resp.hasNextPage;
  }

  return coins;
}
