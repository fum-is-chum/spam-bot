import { SuiClient, SuiObjectChange, SuiObjectData } from "@mysten/sui.js/client";
import { SUI_TYPE_ARG, SuiKit, SuiObjectArg, SuiTxBlock } from "@scallop-io/sui-kit";
import BigNumber from "bignumber.js";
import * as dotenv from "dotenv";
import { MAIN_NODES } from "./const/rpc";
import { Logger } from "./utils/logger";
import { ProtocolConfig } from "@mysten/sui.js/client";
import { shuffle } from "./utils/common";
import { SpamTxBuilder } from "./contract";
import { SuiObjectRef } from "@mysten/sui.js/src/transactions";
dotenv.config();

const mnemonics = process.env.MNEMONICS!;
const batchSize = +(process.env.BATCH_SIZE ?? MAIN_NODES.length);

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
      },
    });

    if (res.effects?.status.status === "success") {
      Logger.success(`Success spam: ${res.digest} with node ${suiKit.suiInteractor.currentFullNode}`);
      return {
        mutations: [
          res.effects.gasObject.reference,
          res.effects.mutated?.find((item) => item.reference.objectId !== res.effects?.gasObject.reference.objectId)
            ?.reference,
        ], // [gas, counter]
        epoch: res.effects.executedEpoch,
      };
    } else {
      console.error(res.errors ? res.errors[0] : "Error occurred");
      return undefined;
    }
  } catch (e) {
    console.error(e);
  }
  return undefined;
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

const updateObject = async (obj: SuiObjectData, ref?: SuiObjectRef) => {
  if(!ref) return;
  obj.version = String(ref.version);
  obj.digest = ref.digest;
};

const registerCounters = async (suiKit: SuiKit, counter: SuiObjectData, gasCoin?: SuiObjectData) => {
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

  SpamTxBuilder.register_user_counter(tx, counter);
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
    Logger.success(`Success register counter ${counter.objectId} : ${res.digest}`);
    return {
      mutations: [
        res.effects.gasObject.reference,
        res.effects.mutated?.find((item) => item.reference.objectId !== res.effects?.gasObject.reference.objectId)
          ?.reference,
      ], // [gas, counter]
      epoch: res.effects.executedEpoch,
    };
  } else {
    console.error(res.errors ? res.errors[0] : "Error occurred");
    return undefined;
  }
};

const claimReward = async (suiKit: SuiKit, counter: SuiObjectData, gasCoin?: SuiObjectData) => {
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

  const spamCoin = SpamTxBuilder.claim_reward(tx, counter);
  tx.transferObjects([spamCoin], suiKit.currentAddress());
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
    Logger.success(`Success register counter ${counter.objectId} : ${res.digest}`);
    return {
      mutations: [
        res.effects.gasObject.reference,
        ...(res.effects.mutated
          ?.filter((item) => item.reference.objectId !== res.effects?.gasObject.reference.objectId)
          .map((item) => item.reference) ?? []),
      ], // [gas, counter]
      epoch: res.effects.executedEpoch,
    };
  } else {
    console.error(res.errors ? res.errors[0] : "Error occurred");
    return undefined;
  }
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
    let initialEpoch = 0;
    let claimCnt = 0;

    let iter = 0;
    while (iter < +(process.env.ITER ?? 1)) {
      for (let i = 0; i < suiKits.length; i++) {
        tasks.push(Promise.race([executeSpam(suiKits[i], counters[i], gasCoins[i]), timeout(10000)]));
      }
      results = await Promise.allSettled(tasks);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      let executedEpoch = 0;
      // update objects
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          const res = (results[i] as PromiseFulfilledResult<any>).value;
          if (res) {
            if (i === 0) {
              if (initialEpoch === 0) {
                initialEpoch = res.epoch;
              }
              executedEpoch = res.epoch;
            }

            if (res.mutations) {
              if (res.mutations[0]) {
                if (!gasCoins[i]) {
                  gasCoins[i] = res.mutations[0];
                } else {
                  updateObject(gasCoins[i], res.mutations[0]);
                }
              }
              if (res.mutations[1]) {
                updateObject(counters[i], res.mutations[1]);
              }
            }
            res.mutations = null;
          }
        }
      }

      tasks = [];
      results = [];

      // check epoch
      if (executedEpoch === initialEpoch + 1) {
        // register previous epoch count to counter object
        tasks.push(
          ...counters.map(async (counter, idx) => {
            const res = await registerCounters(suiKits[idx], counter, gasCoins[idx]);
            if (res && res.mutations) {
              if (res.mutations[0]) {
                if (!gasCoins[idx]) {
                  gasCoins[idx] = res.mutations[0];
                } else {
                  updateObject(gasCoins[idx], res.mutations[0]);
                }
              }
              if (res.mutations[1]) {
                updateObject(counters[idx], res.mutations[1]);
              }
            }
          })
        );
        await Promise.allSettled(tasks);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        tasks = [];
        claimCnt++;
        initialEpoch = executedEpoch;
        // Nice to have: set a Telegram notification bot on error registering counter
      }

      // check for claim
      if (claimCnt === 2) {
        claimCnt = 0;

        // claim $SPAM
        tasks.push(
          ...counters.map(async (counter, idx) => {
            const res = await claimReward(suiKits[idx], counter, gasCoins[idx]);
            if (res && res.mutations) {
              if (res.mutations[0]) {
                if (!gasCoins[idx]) {
                  gasCoins[idx] = res.mutations[0];
                } else {
                  updateObject(gasCoins[idx], res.mutations[0]);
                }
              }
              if (res.mutations[1]) {
                updateObject(counters[idx], res.mutations.find((item) => item.objectId === counter.objectId));
              }
            }
          })
        );

        await Promise.allSettled(tasks);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        tasks = [];
      }
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
