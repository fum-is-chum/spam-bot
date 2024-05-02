import { CoinStruct, SuiObjectChange, SuiObjectData } from "@mysten/sui.js/client";
import { SUI_TYPE_ARG, SuiKit, SuiObjectArg, SuiTxBlock } from "@scallop-io/sui-kit";
import BigNumber from "bignumber.js";
import * as dotenv from "dotenv";
import { MAIN_NODES } from "./const/rpc";
import { Logger } from "./utils/logger";
import { ProtocolConfig } from "@mysten/sui.js/client";
import { shuffle } from "./utils/common";
import { SpamTxBuilder } from "./contract";
import { SuiOwnedObject } from "@scallop-io/sui-kit/dist/libs/suiModel";
dotenv.config();

// const secretKey = process.env.secretKey;
// const parsedSecretKey = secretKey!.startsWith("suiprivkey")
//   ? Array.from(decodeSuiPrivateKey(secretKey!).secretKey)
//       .map((b) => ("00" + b.toString(16)).slice(-2))
//       .join("")
//   : secretKey!;
const mnemonics = process.env.MNEMONICS!;
const batchSize = +(process.env.BATCH_SIZE ?? MAIN_NODES.length);

// let gasCoins: null | CoinStruct[] = null;
console.log(`Batch Size: ${batchSize}`);

const suiKit: SuiKit = new SuiKit({
  mnemonics,
  // secretKey: parsedSecretKey!
});

let protocolConfig: null | ProtocolConfig = null;
const getProtocolConfig = async () => {
  if (!protocolConfig) {
    protocolConfig = await suiKit.client().getProtocolConfig();
  }
  return protocolConfig;
};

const executeSpam = async (suiKit: SuiKit, counterObj: SuiObjectArg, gasCoin?: SuiObjectData) => {
  try {
    const tx = new SuiTxBlock();
    tx.setSender(suiKit.currentAddress());
    if (!!gasCoin) {
      tx.setGasPayment([
        {
          objectId: gasCoin.objectId,
          version: gasCoin.version,
          digest: gasCoin.digest,
        },
      ]);
    }
    SpamTxBuilder.increment_counter(tx, counterObj);

    Logger.info(`Sending spam with node ${suiKit.suiInteractor.currentFullNode}`);
    const txBuildBytes = await tx.txBlock.build({
      client: suiKit.client(),
      protocolConfig: await getProtocolConfig(),
    });

    const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
    // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
    const res = await suiKit.client().executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    if (res.effects?.status.status === "success") {
      Logger.success(`Success spam: ${res.digest} with node ${suiKit.suiInteractor.currentFullNode}`);
      return [...res.objectChanges!]; // [sui, counter]
    } else {
      console.error(res.errors ? res.errors[0] : "Error occurred");
      return undefined;
    }
  } catch (e) {
    console.error(e);
  }
  return undefined;
};

const splitGasCoins = async (): Promise<boolean> => {
  try {
    const suiBalance = await suiKit.getBalance(SUI_TYPE_ARG);
    if (suiBalance.coinObjectCount < batchSize) {
      // split coins
      const totalAmount = BigNumber(suiBalance.totalBalance).div(batchSize).precision(9).toNumber();
      const amounts = Array(batchSize - 1).fill(totalAmount);
      const tx = new SuiTxBlock();
      tx.setSender(suiKit.currentAddress());

      const coins = tx.splitSUIFromGas(amounts);
      tx.transferObjects(
        amounts.map((_, idx) => coins[idx]),
        suiKit.currentAddress()
      );

      const txBuildBytes = await tx.txBlock.build({
        client: suiKit.client(),
        protocolConfig: await getProtocolConfig(),
      });

      const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
      const res = await suiKit.client().executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
        },
      });

      if (res.effects && res.effects.status.status === "success") {
        console.log(`success: ${res.digest}`);
      } else {
        console.error(`failed: ${res.digest}`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const timeout = async (ms: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Task took too long"));
    }, ms);
  });
};

const requestGasCoin = async (suiKit: SuiKit, addresses: string[]) => {
  try {
    const tx = new SuiTxBlock();
    tx.setSender(suiKit.currentAddress());

    const coins = tx.splitSUIFromGas(addresses.map(() => 1e8));
    addresses.map((_, idx) => {
      tx.transferObjects([coins[idx]], addresses[idx]);
    });

    const txBuildBytes = await tx.txBlock.build({
      client: suiKit.client(),
      protocolConfig: await getProtocolConfig(),
    });
    const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
    // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
    const res = await suiKit.client().executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: {
        showEffects: true,
      },
    });
    if (res.effects?.status.status === "success") {
      Logger.success(`Success send gas coins: ${res.digest}`);
    } else {
      Logger.error(res.errors ? res.errors[0] : "Error occurred");
    }
  } catch (e) {
    console.error;
  }
};

const createCounterObject = async (suiKit: SuiKit) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());

  SpamTxBuilder.new_user_counter(tx);
  const txBuildBytes = await tx.txBlock.build({
    client: suiKit.client(),
    protocolConfig: await getProtocolConfig(),
  });
  const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
  // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
  const res = await suiKit.client().executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: {
      showEffects: true,
    },
  });
  if (res.effects?.status.status === "success") {
    Logger.success(`Success create counter: ${res.digest}`);
  } else {
    Logger.error(res.errors ? res.errors[0] : "Error occurred");
  }
};

const getCounterObject = async (suiKit: SuiKit) => {
  // create new counter if not exists
  const get = async () => {
    const counters = await suiKit.client().getOwnedObjects({
      owner: suiKit.currentAddress(),
      filter: {
        MatchAny: [
          {
            StructType: "0x30a644c3485ee9b604f52165668895092191fcaf5489a846afa7fc11cdb9b24a::spam::UserCounter",
          },
        ],
      },
      limit: 1,
    });
    return counters.data.length > 0 ? counters.data[0].data : null;
  };

  const existing = await get();
  if (existing) return existing;

  await createCounterObject(suiKit);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const newCounter = await get();
  if (newCounter) return newCounter;

  throw new Error("Failed to create counter object");
};

const main = async () => {
  const targetAddresses = [];
  try {
    const suiKits: SuiKit[] = Array(batchSize).fill(null);
    const counters: SuiObjectData[] = Array(batchSize).fill(null);
    const gasCoins: SuiObjectData[] = Array(batchSize).fill(null);

    for (let i = 0; i < batchSize; i++) {
      suiKits[i] = new SuiKit({
        fullnodeUrls: [...MAIN_NODES],
        mnemonics,
        // secretKey: parsedSecretKey!,
      });
      suiKits[i].switchAccount({ accountIndex: i });

      // check for gas coin
      // i = 0 is the main account
      if (i > 0) {
        const gasCoin = await suiKits[i].getBalance(SUI_TYPE_ARG);
        console.log(
          `${suiKits[i].currentAddress()} has ${BigNumber(gasCoin.totalBalance)
            .shiftedBy(-1 * 9)
            .toNumber()} SUI`
        );
        if (
          gasCoin.totalBalance === "0" ||
          BigNumber(gasCoin.totalBalance)
            .shiftedBy(-1 * 9)
            .lt(0.1)
        ) {
          targetAddresses.push(suiKits[i].currentAddress());
        }
      }
      shuffle(MAIN_NODES);
    }

    Logger.info("-".repeat(80));
    Logger.info(`Running with ${batchSize} accounts`);

    if (targetAddresses.length > 0) {
      Logger.info(`Requesting gas coin for addresses: ${targetAddresses.join(", ")}`);
      // await requestGasCoin(suiKits[0], targetAddresses);
    }

    // create counter objects
    let tasks = [];
    for (let i = 0; i < suiKits.length; i++) {
      tasks.push(async () => {
        const counter = await getCounterObject(suiKits[i]);
        if (!counter) throw new Error("Failed to get counter object");
        counters[i] = counter;
      });
    }
    await Promise.all(tasks.map((t) => t()));

    tasks = [];
    let results = [];

    await getProtocolConfig();

    let iter = 0;
    while (iter < +(process.env.ITER ?? 1)) {
      for (let i = 0; i < suiKits.length; i++) {
        tasks.push(Promise.race([executeSpam(suiKits[i], counters[i], gasCoins[i]), timeout(10000)]));
      }
      results = await Promise.allSettled(tasks);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // update objects
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          let res = (results[i] as PromiseFulfilledResult<any>).value;
          gasCoins[i] = res.find(
            (item: SuiObjectChange) =>
              "objectType" in item && item.objectType === "0x2::coin::Coin<0x2::sui::SUI>"
          );
          counters[i] = res.find(
            (item: SuiObjectData) =>
              "objectType" in item &&
              item.objectType ===
                "0x30a644c3485ee9b604f52165668895092191fcaf5489a846afa7fc11cdb9b24a::spam::UserCounter"
          );
          res = null;
        }
      }
      tasks = [];
      results = [];
      // try {
      // } catch (e) {
      //   Logger.error(JSON.stringify(e));
      //   // counters = await suiKit.getObjects(counters.map((c) => c.objectId));
      // } finally {
      //   // await new Promise((resolve) => setTimeout(resolve, 2000));
      // }
      iter++;
    }
  } catch (e) {
    Logger.error(JSON.stringify(e));
  }
  return;
};

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => process.exit(0));
