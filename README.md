# lp-farm

source code and deployment scripts of `iZiSwap-Minig` (or called farm) contracts.

currently, we only provide those mining contracts on `zksync network`


# farms

### DynamicRange

you can refer to `zksync/contracts/dynamicRange/`

### OneSide

you can refer to `zksync/contracts/oneSide/`

### FixRange

you can refer to `zksync/contracts/fixRange/`

# build

first clone this repo

```
$ https://github.com/Bella-DeFinTech/lp-farm
```

cd into project root dir and update deps

```
$ cd lp-farm
$ yarn
```

set your private key (for deployment)

```
$ cd zksync
$ touch .secret.js
```
and then, fill the file with following content.

```
module.exports={
    sk: '{your private key}',
    apiKey: ''
}
```
you should fill `sk` field with your private key in the above content.

build

```
$ yarn hardhat compile
```

for deployment, you can refer to scripts under `zksync/deploy/*.ts` for different kinds of minigs.
