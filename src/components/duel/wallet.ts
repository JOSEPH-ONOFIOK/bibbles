"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, getAddress, type Address, type EIP1193Provider } from "viem";
import { robinhood } from "@/duel/config";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const HEX_ID = `0x${robinhood.id.toString(16)}`;

// The browser wallet (MetaMask, Rabby, Coinbase Wallet…), its account and network.
export function useWallet() {
  const [provider, setProvider] = useState<EIP1193Provider | null | undefined>(undefined); // undefined = still checking
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    const eth = window.ethereum ?? null;
    queueMicrotask(() => setProvider(eth));
    if (!eth) return;
    const onAccounts = (a: unknown) => setAddress(Array.isArray(a) && a[0] ? getAddress(a[0] as string) : null);
    const onChain = (c: unknown) => setChainId(Number(c));
    // Reconnect quietly if this site was already allowed
    eth.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    eth.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!provider) return;
    const a = await provider.request({ method: "eth_requestAccounts" });
    setAddress(a[0] ? getAddress(a[0]) : null);
    setChainId(Number(await provider.request({ method: "eth_chainId" })));
  }, [provider]);

  const switchChain = useCallback(async () => {
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX_ID }] });
    } catch (e) {
      // 4902: the wallet doesn't know this network yet, so add it
      if ((e as { code?: number }).code !== 4902) throw e;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: HEX_ID,
            chainName: robinhood.name,
            nativeCurrency: robinhood.nativeCurrency,
            rpcUrls: [...robinhood.rpcUrls.default.http],
            blockExplorerUrls: robinhood.blockExplorers ? [robinhood.blockExplorers.default.url] : undefined,
          },
        ],
      });
    }
  }, [provider]);

  const clients = useMemo(() => {
    if (!provider || !address) return null;
    return {
      wallet: createWalletClient({ account: address, chain: robinhood, transport: custom(provider) }),
      public: createPublicClient({ chain: robinhood, transport: custom(provider) }),
    };
  }, [provider, address]);

  return { provider, address, chainId, onRightChain: chainId === robinhood.id, connect, switchChain, clients };
}

export type Wallet = ReturnType<typeof useWallet>;
