import React,{useState, useEffect, isValidElement} from "react";
import {Link} from "react-router-dom";
import Layout from "./Layout";
import {
    getProducts, 
    getBraintreeClientToken, 
    processPayment,
    createOrder
} from "./apiCore";
import Card from "./Card";
import {isAuthenticated} from "../auth";
import DropIn from "braintree-web-drop-in-react";
import {emptyCart} from "./cartHelpers";

const Checkout = ({products, setRun = f=>f, run = undefined}) =>{
    const [data, setData] = useState({
        loading: false,
        success: false,
        clientToken: null,
        error: "",
        instance:{},
        address:""
    });

    const userId = isAuthenticated && isAuthenticated().user._id;
    const token = isAuthenticated && isAuthenticated().token;
    const getToken = (userId, token) => {
        getBraintreeClientToken(userId, token).then(response => {
            if(response.error){
                setData({...data, error: response.error});
            } else{
                setData({...data, clientToken: response.clientToken});
            }
        });
    }
    useEffect(() => {
        getToken(userId, token);
        
    }, [])

    const handleAddress = event =>{
        setData({...data, address: event.target.value});
    }

    const getTotal = (products) =>{
        return products.reduce((accumulator, nextValue) => {
            return accumulator + nextValue.count * nextValue.price;

        }, 0);
    }
    const showCheckout = () => {
       return isAuthenticated() ? (
            <div>{showDropIn()}</div>
        ) : (
            <Link to="/signin">
                <button className="btn btn-primary">Signin to checkout</button>
            </Link>
            
        )
    }

    let deliveryAddress = data.address;

    const buy = () => {
        setData({...data, loading: true});
        //send the noce to your server
        //nonce = data.instance.requestPaymentMethod()
        let nonce;
        data.instance.requestPaymentMethod()
        .then(paymentData => {
            nonce = paymentData.nonce;
            //console.log("getNonce", getNonce);
            //console.log("send nonce and total to process:", nonce, getTotal(products));
            const payment = {
                paymentMethodNonce: nonce,
                amount: getTotal(products)
            }

            processPayment(userId, token, payment)
            .then(response => {
                //empty cart
                //create order
                console.log("payment response: ", response);
                const createOrderData ={
                    products: products,
                    transaction_id: response.transaction.id,
                    amount: response.transaction.amount,
                    address: deliveryAddress
                }

                createOrder(userId, token, createOrderData)
                .then(response=>{
                    emptyCart(() =>{
                        setRun(!run);
                        console.log("payment success and empty cart");
                        setData({...data, loading: false, success: true});
                    });
                })
                .catch((error)=>{
                    console.log(error);
                });
                
            })
            .catch(error => {
                console.log(error);
                setData({...data, loading: false});
                
            });
            
        })
        .catch(error => {
            console.log("dropin error: ", error);
            setData({...data, error: error.message});
        });
    }

    const showDropIn = () => (
        <div onBlur={() => setData({...data, error: ""})}>
            {data.clientToken !== null && products.length > 0 ? (
                <div>
                    <div className="form-group mb-3">
                         <label className="text-muted">Delivery address</label>
                         <textarea 
                              onChange={handleAddress} 
                              className="form-control" 
                              value={data.address}
                              placeholder="Type your delivery address here..."

                         />
                    </div>
                    <DropIn options={{
                        authorization: data.clientToken,
                        paypal:{
                            flow: "vault"
                        }
                    }} onInstance={instance => data.instance = instance}/>
                    <button onClick={buy} className="btn btn-success btn-block">Pay</button>
                </div>
            ) : null}
        </div>
    )

    const showSuccess = success => (
       <div className="alert alert-info" style={{display: success ? "" : "none"}}>Thanks! Your payment was successful!</div>
    );

    const showError = error => (
        <div className="alert alert-danger" style={{display: error ? "" : "none"}}>{error}</div>
     );

     const showLoading = (loading) =>(loading && <h2>Loading...</h2>);
        
    return <div>
        <h2>Total: ${getTotal(products)}</h2>
        {showLoading(data.loading)}
        {showSuccess(data.success)}
        {showError(data.error)}
        {showCheckout()}
    </div>
};

export default Checkout;