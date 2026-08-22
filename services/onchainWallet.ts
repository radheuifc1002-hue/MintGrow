import { Platform } from 'react-native';

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
  connect?: (options?: any) => Promise<any>;
  disconnect?: () => Promise<void>;
  session?: any;
  accounts?: string[];
};

let walletConnectProvider: Eip1193Provider | null = null;
let walletConnectInit: Promise<Eip1193Provider> | null = null;

function getInjectedProvider(): Eip1193Provider | null {
  if (Platform.OS !== 'web') return null;
  const ethereum = (globalThis as any)?.ethereum;
  return ethereum ?? null;
}

async function getWalletConnectProvider(): Promise<Eip1193Provider> {
  if (walletConnectProvider) return walletConnectProvider;
  if (walletConnectInit) return walletConnectInit;

  walletConnectInit = (async () => {
    const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
      throw new Error('WalletConnect is not configured. Add EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID to the Vercel environment.');
    }

    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
    const provider = await EthereumProvider.init({
      projectId,
      optionalChains: [56],
      showQrModal: true,
      methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
      events: ['accountsChanged', 'chainChanged', 'disconnect'],
      metadata: {
        name: 'MintGrow',
        description: 'MintGrow Telegram Mini App',
        url: process.env.EXPO_PUBLIC_APP_URL || 'https://mintgrow.app',
        icons: [],
      },
      qrModalOptions: { enableMobileFullScreen: true },
    });

    walletConnectProvider = provider as unknown as Eip1193Provider;
    walletConnectInit = null;
    return walletConnectProvider;
  })().catch((error) => {
    walletConnectInit = null;
    throw error;
  });

  return walletConnectInit;
}

async function getWalletProvider(): Promise<Eip1193Provider> {
  // Chrome/desktop can use an injected extension wallet. Telegram's WebView
  // normally has no window.ethereum, so it falls back to WalletConnect.
  return getInjectedProvider() ?? getWalletConnectProvider();
}

export async function connectWallet(): Promise<string> {
  const provider = await getWalletProvider();

  if (provider.connect && !provider.session) {
    await provider.connect();
  }

  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const address = accounts?.[0] ?? provider.accounts?.[0];
  if (!address) throw new Error('No wallet address was returned. Please approve the WalletConnect session.');
  return address;
}

export async function getChainId(): Promise<number> {
  const provider = await getWalletProvider();
  const chainId = await provider.request({ method: 'eth_chainId' });
  return typeof chainId === 'number' ? chainId : Number.parseInt(String(chainId), 16);
}

export async function signTypedData(address: string, typedData: object): Promise<string> {
  const provider = await getWalletProvider();
  return provider.request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  });
}

export function onchainConfig() {
  return {
    chainId: Number(process.env.EXPO_PUBLIC_MG_CHAIN_ID || 56),
    registry: process.env.EXPO_PUBLIC_MG_DELEGATION_REGISTRY || '',
    mgsToken: process.env.EXPO_PUBLIC_MG_MGS_TOKEN || '',
    staking: process.env.EXPO_PUBLIC_MG_STAKING || '',
    apiUrl: process.env.EXPO_PUBLIC_MG_ONCHAIN_API_URL || '',
  };
}

export async function prepareStaking(address: string, amount: string, telegramId?: string) {
  const config = onchainConfig();
  if (!config.apiUrl) throw new Error('MintGrow on-chain API is not configured.');
  const response = await fetch(`${config.apiUrl}/prepare-stake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, amount, telegramId }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || 'Unable to prepare staking authorization.');
  return body;
}

export async function authorizeAndStake(
  address: string,
  telegramId: string | undefined,
  amount: string,
  preparation: any,
) {
  const config = onchainConfig();
  if (!config.apiUrl || !config.registry || !config.staking || !config.mgsToken) {
    throw new Error('MintGrow on-chain configuration is incomplete.');
  }

  const delegationTypedData = {
    domain: {
      name: 'MintGrow Delegation',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.registry,
    },
    primaryType: 'Delegation',
    types: {
      Delegation: [
        { name: 'owner', type: 'address' },
        { name: 'delegate', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
        { name: 'maxAmount', type: 'uint256' },
      ],
    },
    message: {
      owner: address,
      delegate: preparation.delegate,
      nonce: preparation.delegationNonce,
      expiry: preparation.delegationExpiry,
      maxAmount: preparation.delegationMaxAmount,
    },
  };

  const delegationSignature = await signTypedData(address, delegationTypedData);

  const permitTypedData = {
    domain: {
      name: 'Mint Grow Staking',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.mgsToken,
    },
    primaryType: 'Permit',
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner: address,
      spender: config.staking,
      value: preparation.permitAmount,
      nonce: preparation.permitNonce,
      deadline: preparation.permitDeadline,
    },
  };

  const permitSignature = await signTypedData(address, permitTypedData);

  const response = await fetch(`${config.apiUrl}/submit-stake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      address,
      telegramId,
      amount,
      delegation: { signature: delegationSignature },
      permit: { signature: permitSignature },
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || 'Sponsored staking submission failed.');
  return body;
}
