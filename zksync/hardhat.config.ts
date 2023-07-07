import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import {apiKey} from "./.secret"
module.exports = {
  zksolc: {
      version: "1.3.9",
      compilerSource: "binary",
      settings: {},
  },
  defaultNetwork: "zkSyncTestnet",
  //defaultNetwork: "zkSyncMainnet",
  networks: {
     zkSyncTestnet: {
        url: "https://zksync2-testnet.zksync.dev",
        ethNetwork: "goerli", // Can also be the RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
        zksync: true,
     },
     zkSyncMainnet: {
        url: "https://zksync2-mainnet.zksync.io",
        ethNetwork: "https://mainnet.infura.io/v3/",
        zksync: true,
        verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
     }
  },
  solidity: {
     version: "0.8.18",
     settings: {
       optimizer: {
         enabled: true,
         runs: 10
       }
     }
     },
  etherscan: {
    apiKey: apiKey,
  }
};

