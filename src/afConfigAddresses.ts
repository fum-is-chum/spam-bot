import type { ConfigAddresses } from 'aftermath-ts-sdk';
export const afConfigAddresses: ConfigAddresses = {
  pools: {
    packages: {
      amm: "0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c",
      ammInterface:
        "0x0625dc2cd40aee3998a1d6620de8892964c15066e0a285d8b573910ed4c75d50",
      events: "0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c",
    },
    objects: {
      poolRegistry:
        "0xfcc774493db2c45c79f688f88d28023a3e7d98e4ee9f48bbf5c7990f651577ae",
      protocolFeeVault:
        "0xf194d9b1bcad972e45a7dd67dd49b3ee1e3357a00a50850c52cd51bb450e13b4",
      treasury:
        "0x28e499dff5e864a2eafe476269a4f5035f1c16f338da7be18b103499abf271ce",
      insuranceFund:
        "0xf0c40d67b078000e18032334c3325c47b9ec9f3d9ae4128be820d54663d14e3b",
      lpCoinsTable:
        "0x7f3bb65251feccacc7f48461239be1008233b85594114f7bf304e5e5b340bf59",
    },
  },
  referralVault: {
    packages: {
      referralVault:
        "0xc66fabf1a9253e43c70f1cc02d40a1d18db183140ecaae2a3f58fa6b66c55acf",
    },
    objects: {
      referralVault:
        "0x35d35b0e5b177593d8c3a801462485572fc30861e6ce96a55af6dc4730709278",
    },
  },
  router: {
    packages: {
      utils: "0xdc15721baa82ba64822d585a7349a1508f76d94ae80e899b06e48369c257750e",
    },
    aftermath: {
      packages: {
        wrapper:
          "0x3ac8d096a3ee492d40cfe5307f2df364e30b6da6cb515266bca901fc08211d89",
      },
      objects: {
        wrapperApp:
          "0x8c5081566a11912272a0a2bbb0a45cf7412276b72771e0da9ddaedbedbd1b8e9",
      },
    },
    afSui: {
      packages: {
        wrapper: "",
      },
      objects: {
        wrapperApp: "",
        aftermathValidator:
          "0xd30018ec3f5ff1a3c75656abf927a87d7f0529e6dc89c7ddd1bd27ecb05e3db2", // mainnet
      },
    },
    deepBook: {
      packages: {
        clob: "0x000000000000000000000000000000000000000000000000000000000000dee9",
        wrapper:
          "0xf63c58d762286cff1ef8eab36a24c836d23ec0ca19eacbafec7a0275a09cd520",
      },
      objects: {
        wrapperApp:
          "0x37d0ad78503fbdaa239900be3d98e48b620ac1fc2200dbb1d032b89b56f6f7f9",
      },
    },
    cetus: {
      packages: {
        scripts:
          "0x2eeaab737b37137b94bfa8f841f92e36a153641119da3456dec1926b9960d9be",
        clmm: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb",
        wrapper:
          "0x1ec6a8c5ac0b8b97c287cd34b9fc6a94b53a07c930a8505952679dc8d4b3780a",
      },
      objects: {
        globalConfig:
          "0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f",
        poolsTable:
          "0x4c9ab808d50ca1358cc699bb53b6334b9471d4718fb19bb621ff41c2e93bbce4",
        wrapperApp:
          "0x5ec4cfc6beb52525169c32a77e16c288b7bfcb9b898289e94bf3108570b3efa4",
      },
    },
    turbos: {
      packages: {
        clmm: "0x9632f61a796fc54952d9151d80b319e066cba5498a27b495c99e113db09726b1",
        wrapper:
          "0x670139829a5e234b13e5afefa5f11a902700d2dba60cbb467ff880660fa4752e",
      },
      objects: {
        versioned:
          "0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f",
        poolsTable:
          "0x08984ed8705f44b6403705dc248896e56ab7961447820ae29be935ce0d32198b",
        wrapperApp:
          "0x267456695c40f755152f74b3313918e75ddb397d45fcafa99271999937ee6ee8",
      },
    },
    flowX: {
      packages: {
        wrapper:
          "0xc03d737c81247c98b7b5bef774ee6e29e1f3113620e3c909e0be79be07bccc8b",
      },
      objects: {
        container:
          "0xb65dcbf63fd3ad5d0ebfbf334780dc9f785eff38a4459e37ab08fa79576ee511",
        pairsBag:
          "0xd15e209f5a250d6055c264975fee57ec09bf9d6acdda3b5f866f76023d1563e6",
        wrapperApp:
          "0x8931ccc5133dc77d0a1f53f97f87d6a41e4cdcc341f4028548526c2bc7e85f7c",
      },
    },
    interest: {
      packages: {
        dex: "0x5c45d10c26c5fb53bfaff819666da6bc7053d2190dfa29fec311cc666ff1f4b0",
        wrapper:
          "0x0f460b32bc4aae750e803c6ce1f0e231b47f4209cd0a644990e6ab0491c68e00",
      },
      objects: {
        dexStorage:
          "0xdf2ee39f28fdf4bc5d5b5dc89926ac121839f8594fa51b2383a14cb99ab25a77",
        poolsBag:
          "0x108779144605a44e4b5447118b711f0b17adf6168cc9b08551d33daca58098e3",
        wrapperApp:
          "0x3519edeb0ba78715a6a1c986f493f7c9b695d41008600331262d75a5dcd4d76b",
      },
    },
    kriya: {
      packages: {
        dex: "0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66",
        wrapper:
          "0xcc9864d3e331b308875c5fc8da278ee5fdb187ec3923064801e8d2883b80eca1",
      },
      objects: {
        wrapperApp:
          "0xf5950bed5e633bc5f1fdead31e71fe79322bd0efd7e79e6c162e12599e02ca6d",
      },
    },
    baySwap: {
      packages: {
        dex: "0x227f865230dd4fc947321619f56fee37dc7ac582eb22e3eab29816f717512d9d",
        wrapper:
          "0x705b7644364a8d1c04425da3cb8eea8cdc28f58bb2c1cb8f438e4888b8de3178",
      },
      objects: {
        poolsBag:
          "0x72b55bab9064f458451ccf0157e2e0317bcd9b210476b9954081c44ee07b7702",
        globalStorage:
          "0x53568bcc281b720f257e53397b45228186cc3f47e714ab2ab5afea87af7ed903",
        wrapperApp:
          "0xc567736fd7d6e2ee0ea8c7bdfecb7e8189687d63fb573b0f0ca8c985cb42fecb",
      },
    },
    suiswap: {
      packages: {
        dex: "0x361dd589b98e8fcda9a7ee53b85efabef3569d00416640d2faa516e3801d7ffc",
        wrapper:
          "0x2a3beb3c89759988ac1ae0ca3b06837ea7ac263fe82aae50c8a9c1e855224f08",
      },
      objects: {
        wrapperApp:
          "0x60348f62b925d9f42d6a6383bae421e6da9fd5369b4128e84ee84091d478fcc9",
      },
    },
    blueMove: {
      packages: {
        dex: "0xb24b6789e088b876afabca733bed2299fbc9e2d6369be4d1acfa17d8145454d9",
        wrapper:
          "0xfbddc84813743a045f73e857bbc4531bd0e12d1ba14fc1c5c5aee471559859bd",
      },
      objects: {
        dexInfo:
          "0x3f2d9f724f4a1ce5e71676448dc452be9a6243dac9c5b975a588c8c867066e92",
        dexStableInfo:
          "0x5a7eca40df453efe6bb1feae99e5b8fc072d1252cbd1979eb187d625dc9b47c9",
        wrapperApp:
          "0x6a5986f6e4ade2967500478cba1168cc3fd1d0e4d1966f68e68e482bac476d0e",
      },
    },
  },
};
