var creationTime = () => Math.round(new Date().getTime() / 1000) - 15; // Creates a timestamp

async function getBond()  {
    var bondName = document.getElementById("bondName").value;

    const cmd = {
        pactCode: `(relay.pool.get-bond (read-msg 'bond))`,
        meta: Pact.lang.mkMeta("", "2", 0.00000001, 60000, creationTime(), 1000),
        chainId: "2",
        envData: {
          bond: bondName
        }
      }
    try {
      let data = await Pact.fetch.local(cmd, "https://api.chainweb.com/chainweb/0.0/mainnet01/chain/2/pact");
      if (data.result.status === "success") {
        console.log(data.result.data)
        console.log(data.result.data.guard.keys[0].toString());
        localStorage.setItem("bondName", bondName);
        localStorage.setItem("bondOwnerKey", data.result.data.guard.keys[0].toString())
        localStorage.setItem("account", data.result.data.account.toString())
        document.getElementById("enterBond").style.display = "none";
        document.getElementById("loginButton").style.display = "none";
        document.getElementById("renewButton").style.display = "contents";
        document.getElementById("renewButtonGasStation").style.display = "contents";
        document.getElementById("bondLabel").innerHTML = "Found Bond, Renew Date: " + data.result.data.date.timep 
        return true;
      }
      else return false;
    } catch (e){
      console.log(e)
    }
  }

  async function renewBond() {
    const bondName = localStorage.getItem("bondName");
    const pubKeyToSign = localStorage.getItem("bondOwnerKey");
    const account = localStorage.getItem("account");

    const cmd = {
        pactCode: `(relay.pool.renew (read-msg 'bond))`,
        caps: [
          //Pact.lang.mkCap("Gas Station", "free gas", "relay.gas-station.GAS_PAYER", ["free-gas", {int: 1}, 1.0]),
          Pact.lang.mkCap("Bonder", "Bond", "relay.pool.BONDER", [bondName])
        ],
        sender: account,
        gasLimit: 20000,
        gasPrice: 0.00000001,
        networkId: "mainnet01",
        chainId: "2",
        ttl: 1000,
        signingPubKey: pubKeyToSign,
        envData: {
          bond: bondName
        }
      }

      const sign = await Pact.wallet.sign(cmd);
      if (sign) {
        const tx = await fetch("https://api.chainweb.com/chainweb/0.0/mainnet01/chain/2/pact/api/v1/send", {
            headers: {"Content-Type" : "application/json"},
            body: JSON.stringify({"cmds": [sign]}),
            method: "POST"
        })
        if (tx.ok) {
            const data = await tx.json();
            document.getElementById("resultLabel").innerHTML = "Send to blockchain, request key: " + data.requestKeys + "\n..... Waiting for result....";
            localStorage.setItem("tx", data.requestKeys)  
        }
      } else {
          console.log("Something is going wrong with signing");
      }
      getTX();
    }

  async function renewBondFreeGas() {
    const bondName = localStorage.getItem("bondName");
    const pubKeyToSign = localStorage.getItem("bondOwnerKey");

    const cmd = {
        pactCode: `(relay.pool.renew (read-msg 'bond))`,
        caps: [
          Pact.lang.mkCap("Gas Station", "free gas", "relay.gas-station.GAS_PAYER", ["free-gas", {int: 1}, 1.0]),
          Pact.lang.mkCap("Bonder", "Bond", "relay.pool.BONDER", [bondName])
        ],
        sender: 'relay-free-gas',
        gasLimit: 20000,
        gasPrice: 0.00000001,
        networkId: "mainnet01",
        chainId: "2",
        ttl: 1000,
        signingPubKey: pubKeyToSign,
        envData: {
          bond: bondName
        }
      }

      const sign = await Pact.wallet.sign(cmd);
      if (sign) {
        const tx = await fetch("https://api.chainweb.com/chainweb/0.0/mainnet01/chain/2/pact/api/v1/send", {
            headers: {"Content-Type" : "application/json"},
            body: JSON.stringify({"cmds": [sign]}),
            method: "POST"
        })
        if (tx.ok) {
            const data = await tx.json();
            document.getElementById("resultLabel").innerHTML = "Send to blockchain, request key: " + data.requestKeys + "\n..... Waiting for result....";
            localStorage.setItem("tx", data.requestKeys)  
        }
      } else {
          console.log("Something is going wrong with signing");
      }
      getTX();
    }

    async function getTX() {
        console.log("Listening for TX's...")
        const tx = localStorage.getItem("tx");
    
        if (tx != null) {
            try {
                const listen = await fetch("https://api.chainweb.com/chainweb/0.0/mainnet01/chain/2/pact/api/v1/listen", {
                    headers: {"Content-Type" : "application/json"},
                    body: JSON.stringify({"listen" : tx}),
                    method: "POST"
                })
            
                // Wait for the result of the transaction with the TX id (listen)
                const result = await listen.json();
                console.log(result);
                if (result.result.error) {
                    document.getElementById("resultLabel").innerHTML = tx + " : <br>"  + result.result.status + " : <br>" + result.result.error.message;
                }
                else {
                    document.getElementById("resultLabel").innerHTML = tx + " : " + result.result.status;
                }
                
                localStorage.removeItem("tx");
            } catch (error) {
                // Run function again till result
                console.log("Polling Later");
                getTX();
            }
        } else {
            console.log("No TX's in memory")
        }
    }