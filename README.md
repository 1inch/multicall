<p align="center">
  <img src="https://app.1inch.io/assets/images/logo.svg" width="200" alt="1inch network" />
</p>

# Multicall

## This is the package for high-weight optimized calls to blockchain nodes

## Installation

### Node

```
npm install @1inch/multicall
```

### Yarn

```
yarn install @1inch/multicall
```

## Onchain addresses

-   Ethereum mainnet: `0x8d035edd8e09c3283463dade67cc0d49d6868063`
-   BSC mainnet: `0x804708de7af615085203fa2b18eae59c5738e2a9`
-   Polygon mainnet: `0x59a0A6d73e6a5224871f45E6d845ce1574063ADe`

## Contract code
```typescript
/**
 *Submitted for verification at Etherscan.io on 2021-05-23
 */

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;


contract MultiCall {

    struct Call {
        address to;
        bytes data;
    }

    function multicall(Call[] memory calls) public returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint i = 0; i < calls.length; i++) {
            (, results[i]) = calls[i].to.call(calls[i].data);
        }
    }


    // be careful with calls.length == 0
    function multicallWithGasLimitation(Call[] memory calls, uint256 gasBuffer) public returns (bytes[] memory results, uint256 lastSuccessIndex) {
        results = new bytes[](calls.length);
        for (uint i = 0; i < calls.length; i++) {
            (, results[i]) = calls[i].to.call(calls[i].data);
            if (gasleft() < gasBuffer) {
                return (results, i);
            }
        }
        return (results, calls.length - 1);
    }

    function multicallWithGas(Call[] memory calls) public returns (bytes[] memory results, uint256[] memory gasUsed) {
        results = new bytes[](calls.length);
        gasUsed = new uint256[](calls.length);
        for (uint i = 0; i < calls.length; i++) {
            uint256 initialGas = gasleft();
            (, results[i]) = calls[i].to.call(calls[i].data);
            gasUsed[i] = initialGas - gasleft();
        }
    }

    function gaslimit() external view returns (uint256) {
        return block.gaslimit;
    }

    function gasLeft() external view returns (uint256) {
        return gasleft();
    }
}
```

---

## Algorithm activity diagram
![approve](http://www.plantuml.com/plantuml/png/hLJ1Zjem4BtdAqRQ0o1noEunEI14jzLAAmxGgeTI8PCC6ul4Jkr92Oluzuv380aBj8TQIYBRBs_Ul1dRaZ3a1V2Yye8W5YG2s2yK01ZyLQ0b6y2FQivZJpg0db_wVczOOwlP8q_V12CVVTy_3Fy6Vph1dnoyGlySGlNbvLUPIQgeblxnMQX3o1B7SGnInLW2QK0H9MU980ap6te6SnJakTWvfoL9QWNpF9MqF46NgzqoIWgriR3te1x1SuijF2-twDoGQ-Wlr6T9h88LL2omsZdDa3hHdC5u-WdMZE3buxwLxpXQg05GWWhwExG3xyo8gKNeAprebCotabWByoiiwKZIA48Lo_M5FjWcCcMQgSFNEHm93nTEF9SO5OItyh-8TP7zFQebYqxOOZ8IsxnN_MNtBaFT2TasVspGsGY2kDmvbrt_HZFgM0itnaCkrIRucXYz1JH6c_0cr9BEh-z-B5TdrzNc-eyFkKZnpI2gO2BI52Ajo8Y884DAT0ozh4X9HhprdOtyKfy1uPpkXJVjcA7DjM99qe8jeWYjNHVfl_cnCYWs_p7BRYlEk1DstVyFzxgsQeVM8PXe5J44goPpxMRGiaCshDlQQtK3lvK-OJ4-SjcFBWGpZ8i88HFbn47cV33TCKr4MkVZIAUuxIBOstSq-hghTxggwQAMOy4tUrKjNnnyXoYEVRgcGgyfGqtWTOrhqXTg1vbsFhG8HWClc6j39-jSgjNbYOvRnNy0)

---

## Algorithm visualization
![](./docs/img/multicall_with_gas.png)
