import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

import "./index.css";

import AppLogo from "../../assets/images/logo.png"

function Header() {
    return (
        <div className="container">
            <nav className="navbar navbar-expand-lg navbar-light bg-light">
                <Link className="navbar-brand" to="/">
                    <img src={AppLogo} alt="DeFiGuard" />
                </Link>
                <button 
                    className="navbar-toggler" 
                    type="button" 
                    data-toggle="collapse" 
                    data-target="#navbarSupportedContent" 
                    aria-controls="navbarSupportedContent" 
                    aria-expanded="false" 
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarSupportedContent">
                    <ul className="navbar-nav ml-auto">
                        <li className="nav-item">
                            <Link className="nav-link" to="/">Home</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/services">Services</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/about">About</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/features">Features</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/team">Team</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/blog">Blog</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/contact">Contact</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link wallet-link" to="/wallet">Wallet</Link>
                        </li>
                    </ul>
                    <form className="form-inline my-2 my-lg-0">
                        <div className="search_bt">
                            <a href="#"><i className="fa fa-search" aria-hidden="true"></i></a>
                        </div>
                    </form>
               </div>
            </nav>
         </div>
    );
}


export default Header;