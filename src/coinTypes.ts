export type CoinType = "sui" | "usdc" | "usdt";

type CoinInfo = {
    decimal: number;
    address: string;
};

export const coins: Record<CoinType, CoinInfo> = {
    sui: {
        decimal: 9,
        address: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI'
    },
    usdc: {
        decimal: 6,
        address: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN'
    },
    usdt: {
        decimal: 6,
        address: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN'
    },
    // eth: {
    //     decimal: 8,
    //     address: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN'
    // },
    // cetus: {
    //     decimal: 9,
    //     address: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS'
    // },
};