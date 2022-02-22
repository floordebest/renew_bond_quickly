var creationTime = () => Math.round(new Date().getTime() / 1000) - 15; // Creates a timestamp

function loadAccount() {
  const account = localStorage.getItem("account");
  const bond = localStorage.getItem("bondName");

  if (account) {
    //localStorage.clear();
    console.log(account);
    document.getElementById("enterBond").style.display = "none";
    // Load single bond
    getBond();
  } else {
    document.getElementById("showBonds").style.display = "none";
    document.getElementById("logoutButton").style.display = "none";
  }
}

function logout() {
  localStorage.clear();
  window.location.reload()
}

async function getBond()  {
    const account = localStorage.getItem("account");
    var bondName;
    if (account) {
      bondName = localStorage.getItem("bondName");
    } else {
      bondName = document.getElementById("bondName").value;
    }

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
        if (!account) {
          localStorage.setItem("bondName", bondName);
          localStorage.setItem("bondOwnerKey", data.result.data.guard.keys[0].toString());
          localStorage.setItem("account", data.result.data.account.toString());
        }
        document.getElementById("enterBond").style.display = "none";
        document.getElementById("showBonds").style.display = "contents";
        document.getElementById("logoutButton").style.display = "contents";
        document.getElementById("showBonds").innerHTML += 
        `
          <div id="bondData">
            <label id="bondTitle">
              <b>Your Bond:</b> <i>${bondName}</i>
            </label><br>
            <label id="bondLabel">
              Found Bond, Renew Date: ${data.result.data.date.timep}
            </label><br>
            <button onclick="renewBond()" type="button">Renew, I pay for Gas</button>
            <button onclick="renewBondFreeGas()" type="button">Renew, try GasStation</button>
            <button onclick="closeBond()" type="button">Close/Stop bond</button>
          </div>
        `
      }
    } catch (e){
      console.log(e)
    }
  }

  function closeBond(bondID) {
    const bonds = JSON.parse(localStorage.getItem("bonds"))
    console.log(bonds[bondID]);
  }

  async function searchBond()  {
    const account = document.getElementById("accName").value;

    // Fetch All Bonds
    const cmd = {
      pactCode: `(use relay.pool) (map (get-keyed-bond) (bond-keys))`,
      meta: Pact.lang.mkMeta("", "2", 0.00000001, 60000, creationTime(), 1000),
      chainId: "2",
    }
    try {
      let data = await Pact.fetch.local(cmd, "https://api.chainweb.com/chainweb/0.0/mainnet01/chain/2/pact");
      if (data.result.status === "success") {
        const resData = data.result.data;
        localStorage.setItem("bonds", JSON.stringify(resData));
        for (var i = 0; i < resData.length; i++) {
          const accountName = resData[i].bond.account;
          if (accountName.includes(account)) {
            console.log(accountName);
            document.getElementById("enterBond").style.display = "none";
            document.getElementById("showBonds").style.display = "contents";
            document.getElementById("logoutButton").style.display = "contents";
            if (resData[i].bond.terminated == false) {
              document.getElementById("showBonds").innerHTML += 
              `
                <div id="bondData">
                  <label id="bondTitle">
                    <div id="bond${i}>" 
                      <b>Your Bond:</b> <i>${resData[i].key}</i>
                    </div>
                  </label><br>
                  <label id="bondLabel">
                    Renew Date: ${resData[i].bond.date.timep}
                  </label><br>
                  <button onclick="renewBond(${i})" type="button">Renew, I pay for Gas</button>
                  <button onclick="renewBondFreeGas(${i})" type="button">Renew, try GasStation</button>
                  <button onclick="closeBond(${i})" type="button">Close/Stop bond</button>
                </div>
              `
            } else {
              document.getElementById("showBonds").innerHTML += 
              `
              <div id="bondData">
                <label id="bondTitle">
                  <b>Your Bond:</b> <i>${resData[i].key}</i>
                </label><br>
                <label id="bondLabel">
                  Bond is no longer active, Latest Renew Date: ${resData[i].bond.date.timep}
                </label><br>
              </div>
              `
            }
          }
        }
      }
    } catch (e){
      console.log(e)
    }
  }

  async function renewBond(id) {
    var bondName;
    var pubKeyToSign;
    var account;

    if (id) {
      const bonds = JSON.parse(localStorage.getItem("bonds"));
      bondName = bonds[id].key;
      pubKeyToSign = bonds[id].bond.guard.keys[0];
      account = bonds[id].bond.account;
    } else {
      bondName = localStorage.getItem("bondName");
      pubKeyToSign = localStorage.getItem("bondOwnerKey");
      account = localStorage.getItem("account");
    }


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
                //console.log(result);
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

    