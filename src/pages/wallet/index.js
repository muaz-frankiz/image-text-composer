import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './index.css';
import Header from '../../components/header';
import Footer from '../../components/footer';
import WalletInterface from '../../components/wallet';

function Wallet() {
    return (
        <div>
            <div className="header_section">
                <Header />
            </div>
            <div className="wallet_page">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <div className="wallet_header">
                                <h1>DeFiGuard Wallet</h1>
                                <p>Secure Ethereum wallet for sending and receiving ETH</p>
                            </div>
                        </div>
                    </div>
                    <WalletInterface />
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default Wallet;
