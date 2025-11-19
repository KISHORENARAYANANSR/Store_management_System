import React, { useState, useEffect } from "react";
import "../styles/order.css";
import { products } from "../data/products";

export default function OrderPage() {
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState(0);
  const [userDetails, setUserDetails] = useState({
    name: "",
    empId: "",
    dept: "VPP",
    shop: "Trim & Chassis",
    zone: "",
    group: "",
    date: "",
  });

  const [newProduct, setNewProduct] = useState({
    partNumber: "",
    description: "",
    quantity: 1,
  });

  const [openCategory, setOpenCategory] = useState(null);
  const [lockedCategory, setLockedCategory] = useState(null);

  const [materialSearch, setMaterialSearch] = useState("");
  const [ppeSearch, setPpeSearch] = useState("");

  // State for stock and cost data from Excel
  const [stockData, setStockData] = useState([]);
  const [costData, setCostData] = useState([]);

  // Load stock and cost data from localStorage
  useEffect(() => {
    const loadStockAndCostData = () => {
      try {
        const savedStockData = localStorage.getItem("savedStockData");
        const savedCostData = localStorage.getItem("costData");
        
        if (savedStockData) {
          setStockData(JSON.parse(savedStockData));
          console.log("📊 Stock data loaded:", JSON.parse(savedStockData).length, "items");
        }
        
        if (savedCostData) {
          setCostData(JSON.parse(savedCostData));
          console.log("💰 Cost data loaded:", JSON.parse(savedCostData).length, "items");
        }
      } catch (err) {
        console.error("❌ Error loading stock/cost data:", err);
      }
    };

    loadStockAndCostData();

    // Listen for stock updates from dashboard
    const handleStockUpdate = () => {
      console.log("🔄 Stock updated, reloading...");
      loadStockAndCostData();
    };

    window.addEventListener('stockUpdated', handleStockUpdate);
    
    return () => {
      window.removeEventListener('stockUpdated', handleStockUpdate);
    };
  }, []);

  useEffect(() => {
    const savedCategory = window.orderLockedCategory;
    if (savedCategory) {
      setLockedCategory(savedCategory);
    }
  }, []);

  // Helper function to get current stock for a product
  const getCurrentStock = (partNumber) => {
    const stockItem = stockData.find(
      (item) => item.partNumber.toLowerCase() === partNumber.toLowerCase()
    );
    return stockItem ? stockItem.currentStock : 0;
  };

  // Helper function to get cost per unit for a product
  const getCostPerUnit = (partNumber) => {
    const costItem = costData.find(
      (item) => item.partNumber.toLowerCase() === partNumber.toLowerCase()
    );
    return costItem ? costItem.costPerUnit : 0;
  };

  // Helper function to check if product is in stock
  const isInStock = (partNumber, requestedQty) => {
    const currentStock = getCurrentStock(partNumber);
    return currentStock >= requestedQty;
  };

  const lockCategory = (category) => {
    setLockedCategory(category);
    window.orderLockedCategory = category;
  };

  const unlockCategory = () => {
    setLockedCategory(null);
    window.orderLockedCategory = null;
  };

  const addToCart = (product) => {
    // Check stock before adding
    if (!isInStock(product.partNumber, product.quantity)) {
      alert(`⚠️ Out of Stock! Only ${getCurrentStock(product.partNumber)} units available for ${product.partNumber}`);
      return;
    }

    const existing = cart.find(
      (item) =>
        item.id === product.id &&
        item.partNumber.toLowerCase() === product.partNumber.toLowerCase()
    );
    
    if (existing) {
      const newQty = existing.quantity + product.quantity;
      if (!isInStock(product.partNumber, newQty)) {
        alert(`⚠️ Cannot add more! Only ${getCurrentStock(product.partNumber)} units available for ${product.partNumber}`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === product.id &&
          item.partNumber.toLowerCase() === product.partNumber.toLowerCase()
            ? { ...item, quantity: newQty }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, id: product.id || Date.now() }]);
    }
  };

  const updateCartItem = (id, newQty) => {
    if (newQty < 1) return;
    
    const cartItem = cart.find(item => item.id === id);
    if (cartItem && !isInStock(cartItem.partNumber, newQty)) {
      alert(`⚠️ Out of Stock! Only ${getCurrentStock(cartItem.partNumber)} units available for ${cartItem.partNumber}`);
      return;
    }
    
    setCart(
      cart.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
  };

  const removeCartItem = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleCancelOrder = () => {
    if (
      window.confirm(
        "Are you sure you want to cancel this order? All items will be removed from cart."
      )
    ) {
      setCart([]);
      unlockCategory();
      setOpenCategory(null);
      alert("Order cancelled. You can now select a different category.");
    }
  };

  const handlePlaceOrder = async () => {
    if (!cart.length) {
      alert("Cart is empty!");
      return;
    }

    if (!userDetails.name || !userDetails.empId || !userDetails.dept || !userDetails.shop || !userDetails.zone || !userDetails.group) {
      alert("Please fill in all user details before placing order.");
      return;
    }

    // Final stock check before placing order
    for (const item of cart) {
      if (!isInStock(item.partNumber, item.quantity)) {
        alert(`⚠️ Out of Stock! ${item.partNumber} - Only ${getCurrentStock(item.partNumber)} units available`);
        return;
      }
    }

    const orderDate = userDetails.date || new Date().toISOString().split("T")[0];

    const orderPayload = {
      userDetails: {
        ...userDetails,
        date: orderDate,
      },
      category: lockedCategory === "material" ? "Fixed & Variable Material" : 
                lockedCategory === "ppe" ? "PPE's (Personal Protective Equipments)" : 
                lockedCategory === "new" ? "New Product Request" : "Unknown",
      cart: cart.map((item) => ({
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
      })),
    };

    try {
      const res = await fetch("http://localhost:5000/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        console.error("Server returned:", res.status);
        alert(
          "⚠️ Order saved locally but backend is not responding. Check network/server."
        );
        return;
      }

      const data = await res.json();
      console.log("✅ Server response:", data);

      if (data.success) {
        alert("✅ Order placed successfully! Approval email has been sent.");
        setStep(3);
        setCart([]);
        unlockCategory();
      } else {
        alert("⚠️ Order could not be processed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("❌ Fetch error:", err);
      alert("⚠️ Backend connection unavailable. Please try again later.");
    }
  };

  const isUserDetailsValid =
    userDetails.name && userDetails.empId && userDetails.dept && userDetails.shop && userDetails.zone && userDetails.group;

  const materialProducts = products.filter(
    (p) =>
      p.category === "Fixed Cost - Material" ||
      p.category === "Variable Cost - Material"
  );
  const ppeProducts = products.filter(
    (p) => p.category === "PPE's (Personal Protective Equipments)"
  );

  const handleAddNewProduct = () => {
    if (!newProduct.partNumber || !newProduct.quantity) return;
    addToCart({ ...newProduct, id: Date.now() });
    setNewProduct({ partNumber: "", description: "", quantity: 1 });
  };

  const toggleCategory = (category) => {
    if (lockedCategory && lockedCategory !== category) return;

    if (openCategory === category) {
      setOpenCategory(null);
    } else {
      setOpenCategory(category);
      if (!lockedCategory) lockCategory(category);
    }
  };

  const isCategoryVisible = (category) => !lockedCategory || lockedCategory === category;

  // Enhanced product card component
  const ProductCard = ({ product }) => {
    const [quantity, setQuantity] = useState(1);
    const currentStock = getCurrentStock(product.partNumber);
    const costPerUnit = getCostPerUnit(product.partNumber);
    const isStockAvailable = currentStock > 0;

    const handleQuantityChange = (value) => {
      const qty = parseInt(value) || 1;
      if (qty > currentStock) {
        alert(`⚠️ Only ${currentStock} units available!`);
        setQuantity(currentStock);
      } else {
        setQuantity(qty);
      }
    };

    return (
      <div className={`product-card ${!isStockAvailable ? 'out-of-stock' : ''}`}>
        <div className="product-header">
          <h4>{product.partNumber}</h4>
          {costPerUnit > 0 && (
            <span className="product-price">₹{costPerUnit.toFixed(2)}</span>
          )}
        </div>
        <p className="product-description">{product.description}</p>
        
        <div className="stock-info">
          <span className={`stock-badge ${isStockAvailable ? 'in-stock' : 'out-of-stock'}`}>
            {isStockAvailable ? (
              <>
                ✅ In Stock: <strong>{currentStock}</strong>
              </>
            ) : (
              <>❌ Out of Stock</>
            )}
          </span>
        </div>

        {costPerUnit > 0 && quantity > 0 && (
          <div className="total-price">
            Total: ₹{(costPerUnit * quantity).toFixed(2)}
          </div>
        )}

        <div className="card-actions">
          <input
            type="number"
            min="1"
            max={currentStock}
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="qty-input"
            disabled={!isStockAvailable}
          />
          <button
            onClick={() =>
              addToCart({
                ...product,
                quantity: quantity,
              })
            }
            disabled={!isStockAvailable || quantity > currentStock}
            className={!isStockAvailable ? 'disabled-btn' : ''}
          >
            {isStockAvailable ? 'Add' : 'Out of Stock'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="order-page">
      <img src="/Renault-logo.jpg" alt="Background Logo" className="bg-logo" />
      <div className="header-bar">
        <img src="/renault-group-logo.png" alt="Renault Logo" className="logo" />
        {step === 1 && (
          <div className="header-buttons">
            <button className="cancel-btn" onClick={handleCancelOrder}>
              Cancel Order
            </button>
            <button className="review-btn" onClick={() => setStep(2)}>
              Review Cart ({cart.length})
            </button>
          </div>
        )}
      </div>

      {/* Step 0: User Details */}
      {step === 0 && (
        <div className="checkout-box">
          <h2>Enter Your Details</h2>
          <input
            type="text"
            placeholder="Name"
            value={userDetails.name}
            onChange={(e) =>
              setUserDetails({ ...userDetails, name: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Employee ID"
            value={userDetails.empId}
            onChange={(e) =>
              setUserDetails({ ...userDetails, empId: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Department"
            value={userDetails.dept}
            onChange={(e) =>
              setUserDetails({ ...userDetails, dept: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Shop"
            value={userDetails.shop}
            onChange={(e) =>
              setUserDetails({ ...userDetails, shop: e.target.value })
            }
          />
          <select
            value={userDetails.zone}
            onChange={(e) =>
              setUserDetails({ ...userDetails, zone: e.target.value })
            }
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              marginTop: "9px",
              border: "1px solid #000000ff",
              borderRadius: "5px",
              backgroundColor: "white",
              color: userDetails.zone ? "black" : "#5a5959ff",
            }}
          >
            <option value="" disabled>
              Select Zone
            </option>
            <option value="Trim-A">Trim-A</option>
            <option value="Trim-B">Trim-B</option>
            <option value="Under Floor">Under Floor</option>
            <option value="Chassis Trim">Chassis Trim</option>
            <option value="Pre Final">Pre Final</option>
            <option value="Door Sub">Door Sub</option>
            <option value="Engine Sub">Engine Sub</option>
            <option value="Cubs">Cubs</option>
            <option value="CPM">CPM</option>
            <option value="Secondary Logistics">Secondary Logistics</option>
            <option value="Final Line">Final Line</option>
            <option value="EQ - Paint">EQ - Paint</option>
            <option value="EQ - Body">EQ - Body</option>
            <option value="VQA">VQA</option>
            <option value="Project">Project</option>
          </select>

          <select
            value={userDetails.group}
            onChange={(e) =>
              setUserDetails({ ...userDetails, group: e.target.value })
            }
            style={{
              width: "100%",
              padding: "10px",
              marginTop:"10px",
              marginBottom: "10px",
              border: "1px solid #000000ff",
              borderRadius: "5px",
              backgroundColor: "white",
              color: userDetails.group ? "black" : "#5a5959ff",
            }}
          >
            <option value="" disabled>
              Select Group
            </option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
          </select>

          <div className="date-input-wrapper">
            <input
              type="date"
              id="dateInput"
              value={userDetails.date}
              onChange={(e) =>
                setUserDetails({ ...userDetails, date: e.target.value })
              }
            />
            <span
              className="calendar-icon"
              onClick={() => document.getElementById("dateInput").showPicker()}
              style={{ cursor: "pointer" }}
            >
              📅
            </span>
          </div>

          <div className="cart-actions">
            <button disabled>Back</button>
            <button disabled={!isUserDetailsValid} onClick={() => setStep(1)}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Product List */}
      {step === 1 && (
        <div className="product-section">
          <div className="page-header">
            <h2 className="page-heading">Material Order Page</h2>
            {(stockData.length === 0 || costData.length === 0) && (
              <div className="warning-banner">
                ⚠️ Stock/Price data not available. Please upload Excel file from Dashboard.
              </div>
            )}
          </div>

          {lockedCategory && (
            <div className="locked-notice">
              ⚠️ Category Locked: You've selected a category. To change categories,
              click "Cancel Order" button above.
            </div>
          )}

          {/* Material Products */}
          {isCategoryVisible("material") && (
            <div className="category-section">
              <div className="category-header">
                <h3 onClick={() => toggleCategory("material")}>
                  Fixed & Variable Material
                </h3>
                {openCategory === "material" && (
                  <input
                    type="text"
                    placeholder="Search Material..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="product-search-inline"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <span onClick={() => toggleCategory("material")}>
                  {openCategory === "material" ? "▲" : "▼"}
                </span>
              </div>
              {openCategory === "material" && (
                <div className="card-grid">
                  {materialProducts
                    .filter(
                      (p) =>
                        p.partNumber
                          .toLowerCase()
                          .includes(materialSearch.toLowerCase()) ||
                        p.description
                          .toLowerCase()
                          .includes(materialSearch.toLowerCase())
                    )
                    .map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                </div>
              )}
            </div>
          )}

          {/* PPE Products */}
          {isCategoryVisible("ppe") && (
            <div className="category-section">
              <div className="category-header">
                <h3 onClick={() => toggleCategory("ppe")}>
                  PPE's (Personal Protective Equipments)
                </h3>
                {openCategory === "ppe" && (
                  <input
                    type="text"
                    placeholder="Search PPE..."
                    value={ppeSearch}
                    onChange={(e) => setPpeSearch(e.target.value)}
                    className="product-search-inline"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <span onClick={() => toggleCategory("ppe")}>
                  {openCategory === "ppe" ? "▲" : "▼"}
                </span>
              </div>
              {openCategory === "ppe" && (
                <div className="card-grid">
                  {ppeProducts
                    .filter(
                      (p) =>
                        p.partNumber
                          .toLowerCase()
                          .includes(ppeSearch.toLowerCase()) ||
                        p.description
                          .toLowerCase()
                          .includes(ppeSearch.toLowerCase())
                    )
                    .map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                </div>
              )}
            </div>
          )}

          {/* New Product */}
          {isCategoryVisible("new") && (
            <div className="category-section">
              <div className="category-header" onClick={() => toggleCategory("new")}>
                <h3>New Product Request</h3>
                <span>{openCategory === "new" ? "▲" : "▼"}</span>
              </div>
              {openCategory === "new" && (
                <div className="new-product-box">
                  <input
                    type="text"
                    placeholder="Part Name/Description"
                    value={newProduct.partNumber}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, partNumber: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Reason"
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, description: e.target.value })
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Quantity"
                    value={newProduct.quantity}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                  <button onClick={handleAddNewProduct}>Add</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Review Cart */}
      {step === 2 && (
        <div className="checkout-box">
          <h2>Review Your Order</h2>

          <div
            style={{
              marginBottom: "20px",
              padding: "10px",
              backgroundColor: "#f0f0f0",
              borderRadius: "5px",
            }}
          >
            <p>
              <strong>Employee:</strong> {userDetails.name}
            </p>
            <p>
              <strong>Date:</strong> {userDetails.date || new Date().toISOString().split('T')[0]}
            </p>
          </div>

          {cart.length === 0 ? (
            <p>No items in cart</p>
          ) : (
            <>
              {cart.map((item) => {
                const costPerUnit = getCostPerUnit(item.partNumber);
                return (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-details">
                      <span>
                        {item.partNumber} - {item.description}
                      </span>
                      {costPerUnit > 0 && (
                        <span className="cart-item-price">
                          ₹{costPerUnit.toFixed(2)} × {item.quantity} = ₹{(costPerUnit * item.quantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={getCurrentStock(item.partNumber)}
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartItem(item.id, parseInt(e.target.value) || 1)
                      }
                    />
                    <button onClick={() => removeCartItem(item.id)}>Remove</button>
                  </div>
                );
              })}
              {costData.length > 0 && (
                <div className="cart-total">
                  <strong>Total Amount: ₹{cart.reduce((total, item) => {
                    const cost = getCostPerUnit(item.partNumber);
                    return total + (cost * item.quantity);
                  }, 0).toFixed(2)}</strong>
                </div>
              )}
            </>
          )}
          <div className="cart-actions">
            <button onClick={() => setStep(1)}>Back</button>
            <button disabled={cart.length === 0} onClick={handlePlaceOrder}>
              Place Order
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="order-success">✅ Order Placed Successfully!</div>
      )}
    </div>
  );
}