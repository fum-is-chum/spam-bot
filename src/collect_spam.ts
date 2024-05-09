import { SuiKit, SuiTxBlock } from "@scallop-io/sui-kit";
import { MAIN_NODES } from "./const/rpc";
import { PaginatedCoins } from "@mysten/sui.js/client";
import { Logger } from "./utils/logger";
import BigNumber from "bignumber.js";
import * as dotenv from "dotenv";
dotenv.config();

const mnemonics = process.env.MNEMONICS!;
const batchSize = +(process.env.BATCH_SIZE ?? MAIN_NODES.length);

const SPAM_COIN_TYPE = "0x30a644c3485ee9b604f52165668895092191fcaf5489a846afa7fc11cdb9b24a::spam::SPAM" as const;

const getAllCoin = async (suiKit: SuiKit, owner: string, coinType: string) => {
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

  return coins.map((coin) => ({
    ...coin,
    objectId: coin.coinObjectId,
  }));
};

const sendToAddress = async (suiKit: SuiKit, targetAddress: string) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());

  /*
    - Get all $SPAM coin
    - Merge into single object
    - Transfer to dest address
    - $SPAM!
  */
  const spamCoins = await getAllCoin(suiKit, suiKit.currentAddress(), SPAM_COIN_TYPE);
  if (spamCoins.length === 0) {
    Logger.warn(`No $SPAM coin found in ${suiKit.currentAddress()}`);
    return;
  }

  const totalSpamBalance = spamCoins
    .reduce((acc, coin) => acc.plus(BigNumber(coin.balance)), BigNumber(0))
    .shiftedBy(-4)
    .toString();
  Logger.highlight(`Sending ${totalSpamBalance} $SPAM from ${suiKit.currentAddress()} to ${targetAddress}...`);

  if (spamCoins.length > 1) {
    tx.mergeCoins(spamCoins[0], spamCoins.slice(1));
  }
  tx.transferObjects([spamCoins[0]], targetAddress);

  const res = await suiKit.signAndSendTxn(tx);
  if (res.effects?.status.status === "success") {
    Logger.success(`Success send $SPAM to ${targetAddress} : ${res.digest}`);
  } else {
    console.error(res.errors ? res.errors[0] : "Error occurred");
    return undefined;
  }
};

const main = async () => {
  const suiKits: SuiKit[] = Array(batchSize).fill(null);
  for (let i = 0; i < batchSize; i++) {
    suiKits[i] = new SuiKit({
      fullnodeUrls: [...MAIN_NODES],
      mnemonics,
      // secretKey: parsedSecretKey!,
    });
    suiKits[i].switchAccount({ accountIndex: i });
  }

  const targetAddress = process.env.TARGET_ADDRESS;
  if (!targetAddress) throw new Error("TARGET_ADDRESS is required");

  // send $SPAM
  const tasks = suiKits.map((suiKit) =>
    sendToAddress(suiKit, "0x61819c99588108d9f7710047e6ad8f2da598de8e98a26ea62bd7ad9847f5329c")
  );
  await Promise.allSettled(tasks);
};

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => process.exit(0));
