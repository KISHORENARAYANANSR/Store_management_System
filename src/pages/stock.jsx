import React, { useEffect, useState } from "react";
import { products } from "../data/products";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import "../styles/stock.css";

export default function Stock() {
  const navigate = useNavigate();
  const [stockData, setStockData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [scanPartNumber, setScanPartNumber] = useState("");
  const [scanQuantity, setScanQuantity] = useState("");

  // Load stock data from localStorage (changed from sessionStorage)
  const loadStockData = () => {
    console.log("📊 Loading stock data...");
    
    // First, try to get saved stock data
    const savedStock = localStorage.getItem("savedStockData");
    if (savedStock) {
      try {
        const parsed = JSON.parse(savedStock);
        console.log("✅ Loaded saved stock data:", parsed.length, "items");
        setStockData(parsed);
        return;
      } catch (err) {
        console.error("Error parsing saved stock:", err);
      }
    }

    // If no saved stock, try to load from uploaded Excel
    const uploadedExcel = localStorage.getItem("uploadedExcel");
    if (uploadedExcel) {
      try {
        const excelData = JSON.parse(uploadedExcel);
        console.log("📂 Processing uploaded Excel data:", excelData.length, "rows");
        
        // Get all product part numbers for matching
        const productPartNumbers = products.map((p) => p.partNumber.trim().toLowerCase());
        
        const matched = excelData
          .map((row) => {
            // Get part number from Material column
            const partNum = (row["Material"] || row["material"] || "").toString().trim();
            if (!partNum) return null;

            // Check if this product exists in products.js
            const normalizedPartNum = partNum.toLowerCase();
            if (!productPartNumbers.includes(normalizedPartNum)) {
              return null; // Skip products not in products.js
            }

            // Find the product to get description
            const product = products.find(
              (p) => p.partNumber.trim().toLowerCase() === normalizedPartNum
            );

            const productName = product 
              ? product.description 
              : (row["Material Description"] || row["Description"] || "Unknown Product");

            const currentStock = Number(
              row["Unrestricted"] || 
              row["unrestricted"] || 
              row["Unrestricted Stock"] ||
              0
            );

            return { 
              partNumber: partNum, 
              productName, 
              currentStock 
            };
          })
          .filter((item) => item !== null);

        console.log("✅ Matched products from Excel:", matched.length);
        setStockData(matched);
        localStorage.setItem("savedStockData", JSON.stringify(matched));
      } catch (err) {
        console.error("Error parsing uploadedExcel:", err);
      }
    } else {
      console.log("ℹ️ No stock data found");
    }
  };

  // Initial load
  useEffect(() => {
    loadStockData();
  }, []);

  // Listen for custom stockUpdated event
  useEffect(() => {
    const handleStockUpdate = () => {
      console.log("🔄 Stock update event received, reloading data");
      loadStockData();
    };
    
    window.addEventListener("stockUpdated", handleStockUpdate);
    return () => window.removeEventListener("stockUpdated", handleStockUpdate);
  }, []);

  // Listen for storage changes (when Excel is uploaded in dashboard)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "savedStockData" || e.key === "uploadedExcel") {
        console.log("🔄 Storage changed, reloading stock data");
        loadStockData();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Save stock data whenever it changes
  useEffect(() => {
    if (stockData.length > 0) {
      console.log("💾 Saving stock data to localStorage:", stockData.length, "items");
      localStorage.setItem("savedStockData", JSON.stringify(stockData));
    }
  }, [stockData]);

  // Filter stock table
  const filteredData = stockData.filter(
    (item) =>
      item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle scanning/updating stock
  const handleScanSubmit = () => {
    if (!scanPartNumber || !scanQuantity) {
      alert("Please enter both Part Number and Quantity");
      return;
    }

    const quantityNum = Number(scanQuantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      alert("Please enter a valid positive quantity");
      return;
    }

    console.log("📦 Scanning product:", scanPartNumber, "Quantity:", quantityNum);

    let updatedStock = [...stockData];
    const normalizedScanPart = scanPartNumber.trim().toLowerCase();
    
    const index = updatedStock.findIndex(
      (item) => item.partNumber.toLowerCase() === normalizedScanPart
    );

    if (index !== -1) {
      // Product exists, add to current stock
      updatedStock[index].currentStock += quantityNum;
      console.log("✅ Updated existing stock for:", scanPartNumber);
      alert(`✅ Added ${quantityNum} units to ${scanPartNumber}\nNew Stock: ${updatedStock[index].currentStock}`);
    } else {
      // New product, check if it exists in products.js
      const product = products.find(
        (p) => p.partNumber.trim().toLowerCase() === normalizedScanPart
      );

      if (!product) {
        alert(`⚠️ Product ${scanPartNumber} not found in product database!`);
        return;
      }

      updatedStock.push({
        partNumber: scanPartNumber.trim(),
        productName: product.description,
        currentStock: quantityNum,
      });
      console.log("✅ Added new product to stock:", scanPartNumber);
      alert(`✅ Added new product ${scanPartNumber} with ${quantityNum} units`);
    }

    setStockData(updatedStock);
    
    setShowPopup(false);
    setScanPartNumber("");
    setScanQuantity("");
  };

  // Download stock report
  const handleDownloadReport = () => {
    if (stockData.length === 0) {
      alert("No stock data available to export!");
      return;
    }

    const exportData = stockData.map((item) => {
      const product = products.find(
        (p) => p.partNumber.toLowerCase() === item.partNumber.toLowerCase()
      );
      return {
        "Part Number": item.partNumber,
        "Product Name": item.productName,
        "Current Stock": item.currentStock,
        "Location": product ? product.location || "" : "",
        "GL Code": product ? product.glCode || "" : "",
        "Cost Center": product ? product.costCenter || "" : "",
        "Category": product ? product.category || "" : "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Report");

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    XLSX.writeFile(wb, `Stock_Report_${dateStr}.xlsx`);
    
    console.log("📥 Stock report downloaded");
  };

  return (
    <div className="stock-page">
      <div className="renault-logo-top">
        <img src="/renault-group-logo.png" alt="Renault" />
      </div>
      <div className="renault-logo-bg"></div>

      <div className="stock-content">
        <div className="table-heading-container">
          <h2>📦 Current Stock Overview</h2>
          <div className="heading-buttons">
            <button className="home-btn" onClick={() => navigate("/dashboard")}>
              🏠 Home
            </button>
            <button className="scan-btn" onClick={() => setShowPopup(true)}>
              📷 Scan Product
            </button>
            <button className="download-btn" onClick={handleDownloadReport}>
              📥 Download Report
            </button>
          </div>
        </div>

        <div className="search-bar-container">
          <input
            type="text"
            placeholder="🔍 Search by Part Number or Product Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
        </div>

        {stockData.length === 0 && (
          <div style={{ 
            textAlign: "center", 
            padding: "20px", 
            backgroundColor: "#fff3cd", 
            margin: "20px",
            borderRadius: "5px",
            border: "1px solid #ffc107"
          }}>
            <p style={{ margin: 0, fontSize: "16px" }}>
              ⚠️ No stock data available. Please upload an Excel file in the Dashboard first.
            </p>
          </div>
        )}

        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Part Number</th>
                <th>Product Name (Description)</th>
                <th>Current Stock (Unrestricted)</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.partNumber}</td>
                    <td>{item.productName}</td>
                    <td>
                      <span style={{ 
                        fontWeight: "bold",
                        color: item.currentStock <= 0 ? "red" : 
                               item.currentStock < 10 ? "orange" : "green"
                      }}>
                        {item.currentStock}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>
                    {searchTerm ? "No matching products found." : "No stock data available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-modal">
            <h3>📷 Scan Product</h3>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
              Enter the part number and quantity to add to stock
            </p>
            <input
              type="text"
              placeholder="Part Number (e.g., 95000029)"
              value={scanPartNumber}
              onChange={(e) => setScanPartNumber(e.target.value)}
              style={{ marginBottom: "10px" }}
            />
            <input
              type="number"
              placeholder="Quantity to Add"
              value={scanQuantity}
              onChange={(e) => setScanQuantity(e.target.value)}
              min="1"
              style={{ marginBottom: "15px" }}
            />
            <div className="popup-buttons">
              <button className="add-btn" onClick={handleScanSubmit}>
                ✅ Add Quantity
              </button>
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowPopup(false);
                  setScanPartNumber("");
                  setScanQuantity("");
                }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}