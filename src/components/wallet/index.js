import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import './index.css';

const WalletInterface = () => {
    const [web3, setWeb3] = useState(null);
    const [account, setAccount] = useState(null);
    const [balance, setBalance] = useState('0');
    const [balanceUSD, setBalanceUSD] = useState('0');
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [sendForm, setSendForm] = useState({
        to: '',
        amount: '',
        gasPrice: '20'
    });
    const [transactions, setTransactions] = useState([]);
    const [ethPrice, setEthPrice] = useState(0);
    const [networkId, setNetworkId] = useState(null);
    const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

    // Initialize Web3 and get ETH price
    useEffect(() => {
        initializeWeb3();
        fetchEthPrice();
    }, []);

    // Update balance when account changes
    useEffect(() => {
        if (account && web3) {
            updateBalance();
        }
    }, [account, web3]);

    const initializeWeb3 = async () => {
        // Wait for window.ethereum to be available
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const web3Instance = new Web3(window.ethereum);
                setWeb3(web3Instance);
                
                // Check if already connected
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                    setIsConnected(true);
                }
                
                // Check network
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                setNetworkId(chainId);
                checkNetwork(chainId);
            } catch (error) {
                console.error('Error initializing Web3:', error);
                showMessage('error', 'Failed to initialize Web3. Please refresh the page and try again.');
            }
        } else {
            // Don't show error immediately, let user try to connect first
            console.log('MetaMask not detected on page load');
        }
    };

    const fetchEthPrice = async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const data = await response.json();
            setEthPrice(data.ethereum.usd);
        } catch (error) {
            console.error('Error fetching ETH price:', error);
        }
    };

    const getNetworkName = (chainId) => {
        const networks = {
            '0x1': 'Ethereum Mainnet',
            '0x5': 'Goerli Testnet',
            '0xaa36a7': 'Sepolia Testnet'
        };
        return networks[chainId] || `Unknown Network (${chainId})`;
    };

    const checkNetwork = (chainId) => {
        // Ethereum Mainnet: 0x1, Goerli: 0x5, Sepolia: 0xaa36a7
        const supportedNetworks = ['0x1', '0x5', '0xaa36a7'];
        const isSupported = supportedNetworks.includes(chainId);
        setIsCorrectNetwork(isSupported);
        
        if (!isSupported) {
            showMessage('error', `Unsupported network. Please switch to Ethereum Mainnet, Goerli, or Sepolia testnet. Current: ${getNetworkName(chainId)}`);
        }
    };

    const connectWallet = async () => {
        setLoading(true);
        
        // Check if MetaMask is installed
        if (typeof window === 'undefined' || !window.ethereum) {
            showMessage('error', 'MetaMask is not installed. Please install MetaMask browser extension to use this wallet.');
            setLoading(false);
            return;
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            if (accounts.length > 0) {
                // Initialize Web3 if not already done
                if (!web3) {
                    const web3Instance = new Web3(window.ethereum);
                    setWeb3(web3Instance);
                }
                
                setAccount(accounts[0]);
                setIsConnected(true);
                showMessage('success', 'Wallet connected successfully!');
                
                // Listen for account changes
                window.ethereum.on('accountsChanged', (newAccounts) => {
                    if (newAccounts.length > 0) {
                        setAccount(newAccounts[0]);
                    } else {
                        setAccount(null);
                        setIsConnected(false);
                        setWeb3(null);
                    }
                });

                // Listen for network changes
                window.ethereum.on('chainChanged', (chainId) => {
                    console.log('Network changed:', chainId);
                    setNetworkId(chainId);
                    checkNetwork(chainId);
                });
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            if (error.code === 4001) {
                showMessage('error', 'Connection rejected. Please approve the connection in MetaMask.');
            } else if (error.code === -32002) {
                showMessage('error', 'Connection request already pending. Please check MetaMask.');
            } else {
                showMessage('error', `Failed to connect wallet: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const updateBalance = async () => {
        if (!web3 || !account) return;

        try {
            const balanceWei = await web3.eth.getBalance(account);
            const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
            setBalance(parseFloat(balanceEth).toFixed(4));
            
            if (ethPrice > 0) {
                const usdValue = (parseFloat(balanceEth) * ethPrice).toFixed(2);
                setBalanceUSD(usdValue);
            }
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    };

    const sendTransaction = async () => {
        if (!web3 || !account) {
            showMessage('error', 'Please connect your wallet first');
            return;
        }

        if (!sendForm.to || !sendForm.amount) {
            showMessage('error', 'Please fill in all fields');
            return;
        }

        if (!web3.utils.isAddress(sendForm.to)) {
            showMessage('error', 'Invalid recipient address');
            return;
        }

        setLoading(true);
        try {
            const amountWei = web3.utils.toWei(sendForm.amount, 'ether');
            const gasPrice = web3.utils.toWei(sendForm.gasPrice, 'gwei');
            
            // Estimate gas
            const gasEstimate = await web3.eth.estimateGas({
                from: account,
                to: sendForm.to,
                value: amountWei
            });

            const transaction = {
                from: account,
                to: sendForm.to,
                value: amountWei,
                gas: gasEstimate,
                gasPrice: gasPrice
            };

            const receipt = await web3.eth.sendTransaction(transaction);
            
            // Add to transaction history
            const newTransaction = {
                hash: receipt.transactionHash,
                to: sendForm.to,
                amount: sendForm.amount,
                type: 'sent',
                timestamp: new Date().toISOString()
            };
            setTransactions(prev => [newTransaction, ...prev]);
            
            showMessage('success', `Transaction sent successfully! Hash: ${receipt.transactionHash}`);
            setSendForm({ to: '', amount: '', gasPrice: '20' });
            updateBalance();
        } catch (error) {
            console.error('Error sending transaction:', error);
            showMessage('error', `Transaction failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const copyAddress = () => {
        if (account) {
            navigator.clipboard.writeText(account);
            showMessage('success', 'Address copied to clipboard!');
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => {
            setMessage({ type: '', text: '' });
        }, 5000);
    };

    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    if (!isConnected) {
        return (
            <div className="wallet_container">
                <div className="text-center">
                    <h2>Connect Your Wallet</h2>
                    <p>Connect your MetaMask wallet to start using DeFiGuard Wallet</p>
                    
                    <div className="connection_guide">
                        <h4>How to connect:</h4>
                        <ol>
                            <li>Install MetaMask browser extension if you haven't already</li>
                            <li>Click the "Connect MetaMask" button below</li>
                            <li>Approve the connection in the MetaMask popup</li>
                            <li>Start sending and receiving ETH!</li>
                        </ol>
                    </div>
                    
                    <button 
                        className="connect_btn" 
                        onClick={connectWallet}
                        disabled={loading}
                    >
                        {loading ? 'Connecting...' : 'Connect MetaMask'}
                    </button>
                    
                    {message.text && (
                        <div className={`status_message status_${message.type}`}>
                            {message.text}
                        </div>
                    )}
                    
                    <div className="metamask_info">
                        <p><strong>Don't have MetaMask?</strong></p>
                        <a 
                            href="https://metamask.io/download/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="metamask_link"
                        >
                            Download MetaMask Extension
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wallet_container">
            {message.text && (
                <div className={`status_message status_${message.type}`}>
                    {message.text}
                </div>
            )}

            {!isCorrectNetwork && (
                <div className="network_warning">
                    <h4>⚠️ Wrong Network</h4>
                    <p>Please switch to Ethereum Mainnet, Goerli, or Sepolia testnet in MetaMask to use this wallet.</p>
                    <p><strong>Current Network:</strong> {getNetworkName(networkId)}</p>
                </div>
            )}

            {/* Balance Section */}
            <div className="wallet_balance">
                <h3>Your Balance</h3>
                <div className="balance_amount">{balance} ETH</div>
                <div className="balance_usd">≈ ${balanceUSD} USD</div>
            </div>

            {/* Address Section */}
            <div className="wallet_address">
                <h4>Your Wallet Address</h4>
                <div className="address_display">
                    <span className="address_text">{account}</span>
                    <button className="copy_btn" onClick={copyAddress}>
                        Copy
                    </button>
                </div>
                {networkId && (
                    <div className="network_info">
                        <span className="network_label">Network:</span>
                        <span className="network_name">{getNetworkName(networkId)}</span>
                    </div>
                )}
            </div>

            {/* Actions Section */}
            <div className="wallet_actions">
                {/* Send Section */}
                <div className="action_card">
                    <h4>Send ETH</h4>
                    <div className="form_group">
                        <label>Recipient Address</label>
                        <input
                            type="text"
                            placeholder="0x..."
                            value={sendForm.to}
                            onChange={(e) => setSendForm({...sendForm, to: e.target.value})}
                        />
                    </div>
                    <div className="form_group">
                        <label>Amount (ETH)</label>
                        <input
                            type="number"
                            step="0.001"
                            placeholder="0.0"
                            value={sendForm.amount}
                            onChange={(e) => setSendForm({...sendForm, amount: e.target.value})}
                        />
                    </div>
                    <div className="form_group">
                        <label>Gas Price (Gwei)</label>
                        <input
                            type="number"
                            placeholder="20"
                            value={sendForm.gasPrice}
                            onChange={(e) => setSendForm({...sendForm, gasPrice: e.target.value})}
                        />
                    </div>
                    <button 
                        className="action_btn send_btn"
                        onClick={sendTransaction}
                        disabled={loading}
                    >
                        {loading ? 'Sending...' : 'Send ETH'}
                    </button>
                </div>

                {/* Receive Section */}
                <div className="action_card">
                    <h4>Receive ETH</h4>
                    <p>Share your wallet address to receive ETH:</p>
                    <div className="address_display">
                        <span className="address_text">{formatAddress(account)}</span>
                        <button className="copy_btn" onClick={copyAddress}>
                            Copy
                        </button>
                    </div>
                    <button 
                        className="action_btn receive_btn"
                        onClick={copyAddress}
                    >
                        Copy Full Address
                    </button>
                </div>
            </div>

            {/* Transaction History */}
            {transactions.length > 0 && (
                <div className="transaction_history">
                    <h4>Recent Transactions</h4>
                    {transactions.map((tx, index) => (
                        <div key={index} className="transaction_item">
                            <div className="transaction_details">
                                <div className="transaction_type">
                                    {tx.type === 'sent' ? 'Sent' : 'Received'}
                                </div>
                                <div className="transaction_address">
                                    To: {formatAddress(tx.to)}
                                </div>
                            </div>
                            <div className={`transaction_amount ${tx.type === 'sent' ? 'amount_sent' : 'amount_received'}`}>
                                {tx.type === 'sent' ? '-' : '+'}{tx.amount} ETH
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WalletInterface;
