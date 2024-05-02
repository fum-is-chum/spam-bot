import { CoinType} from './coinTypes';

export function generateTradeAmounts(amount: number): { [key in CoinType]: number } {
    let tradeAmounts: { [key in CoinType]: number } = {
        'sui': amount,
        'usdc': amount,
        'usdt': amount,
        // 'eth': amount,
        // 'cetus': amount,
    };
    return tradeAmounts;
}