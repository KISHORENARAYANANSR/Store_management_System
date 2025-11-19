import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import * as XLSX from "xlsx";
import "../styles/dashboard.css";
import { products } from "../data/products";
import { useNavigate } from "react-router-dom";

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  
  const [filterVisible, setFilterVisible] = useState(false);
  
  const [filterDate, setFilterDate] = useState(() => {
    return localStorage.getItem("filterDate") || "";
  });
  
  const [filterStatus, setFilterStatus] = useState(() => {
    return localStorage.getItem("filterStatus") || "All";
  });

  const [filterCategory, setFilterCategory] = useState(() => {
    return localStorage.getItem("filterCategory") || "All";
  });
  
  const [popupOrder, setPopupOrder] = useState(null);
  const [deliveredQuantities, setDeliveredQuantities] = useState({});
  const [reorderVisible, setReorderVisible] = useState(false);
  
  const [reorderProducts, setReorderProducts] = useState(() => {
    const saved = localStorage.getItem("reorderProducts");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [uploadVisible, setUploadVisible] = useState(false);
  
  const [costData, setCostData] = useState(() => {
    const saved = localStorage.getItem("costData");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [selectedFileName, setSelectedFileName] = useState(() => {
    return localStorage.getItem("selectedFileName") || "";
  });
  
  const [cpuPopupVisible, setCpuPopupVisible] = useState(false);
  
  const [cpuVolume, setCpuVolume] = useState(() => {
    return localStorage.getItem("cpuVolume") || "";
  });
  
  const [cpuTarget, setCpuTarget] = useState(() => {
    return localStorage.getItem("cpuTarget") || "";
  });

  // Zone-wise CPU data
  const [zoneWiseCpuData, setZoneWiseCpuData] = useState(() => {
    const saved = localStorage.getItem("zoneWiseCpuData");
    return saved ? JSON.parse(saved) : {};
  });

  const [currentZoneForCpu, setCurrentZoneForCpu] = useState(null);

  const [rfidInput, setRfidInput] = useState("");
  const [waitingForRfid, setWaitingForRfid] = useState(null);

  const [rfidData, setRfidData] = useState(() => {
    const saved = localStorage.getItem("rfidData");
    return saved ? JSON.parse(saved) : [];
  });

  const [rfidUploadVisible, setRfidUploadVisible] = useState(false);
  const [rfidFileName, setRfidFileName] = useState(() => {
    return localStorage.getItem("rfidFileName") || "";
  });

  const [showZoneGraphs, setShowZoneGraphs] = useState(false);

  const navigate = useNavigate();

  // Helper function to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date)) return "N/A";
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // Save filter states to localStorage
  useEffect(() => {
    localStorage.setItem("filterDate", filterDate);
  }, [filterDate]);

  useEffect(() => {
    localStorage.setItem("filterStatus", filterStatus);
  }, [filterStatus]);

  useEffect(() => {
    localStorage.setItem("filterCategory", filterCategory);
  }, [filterCategory]);

  useEffect(() => {
    console.log("💾 Saving cost data to localStorage");
    localStorage.setItem("costData", JSON.stringify(costData));
  }, [costData]);

  useEffect(() => {
    console.log("💾 Saving reorder products to localStorage:", reorderProducts.length);
    localStorage.setItem("reorderProducts", JSON.stringify(reorderProducts));
  }, [reorderProducts]);

  useEffect(() => {
    localStorage.setItem("selectedFileName", selectedFileName);
  }, [selectedFileName]);

  useEffect(() => {
    if (cpuVolume !== "") {
      localStorage.setItem("cpuVolume", cpuVolume);
    }
  }, [cpuVolume]);

  useEffect(() => {
    if (cpuTarget !== "") {
      localStorage.setItem("cpuTarget", cpuTarget);
    }
  }, [cpuTarget]);

  useEffect(() => {
    localStorage.setItem("rfidData", JSON.stringify(rfidData));
  }, [rfidData]);

  useEffect(() => {
    localStorage.setItem("rfidFileName", rfidFileName);
  }, [rfidFileName]);

  useEffect(() => {
    localStorage.setItem("zoneWiseCpuData", JSON.stringify(zoneWiseCpuData));
  }, [zoneWiseCpuData]);

  // Fetch orders from backend
  const fetchOrdersFromBackend = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/orders");
      if (res.ok) {
        const backendOrders = await res.json();
        console.log("📦 Orders from backend:", backendOrders.length);
        setOrders(backendOrders);
      }
    } catch (err) {
      console.log("❌ Backend not available, no orders loaded");
      setOrders([]);
    }
  };

  // Initial fetch of orders
  useEffect(() => {
    fetchOrdersFromBackend();
  }, []);

  // RFID Scanner listener
  useEffect(() => {
    const handleKeyPress = async (e) => {
      if (!waitingForRfid) return;

      if (e.key === "Enter") {
        if (rfidInput.trim()) {
          console.log("📡 RFID Scanned:", rfidInput.trim());
          
          const rfidMatch = rfidData.find(
            (item) => item.cardNumber && item.cardNumber.toString().trim() === rfidInput.trim()
          );
          
          const displayText = rfidMatch && rfidMatch.idNumber && rfidMatch.name 
            ? `${rfidMatch.idNumber} - ${rfidMatch.name}`
            : rfidInput.trim();
          
          const order = orders.find(o => o.id === waitingForRfid);
          const collectionType = order?.status === "Partial" ? "Partial" : "Full";
          
          try {
            // Save to database
            const response = await fetch(`http://localhost:5000/api/order/${waitingForRfid}/collection`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                collectedBy: displayText,
                collectionType: collectionType
              })
            });

            if (!response.ok) {
              throw new Error('Failed to save collection');
            }

            console.log(`✅ Collection saved to database for order ${waitingForRfid}`);
            
            // Refresh orders from backend to get updated collection history
            await fetchOrdersFromBackend();
            
          } catch (err) {
            console.error("❌ Error saving collection:", err);
            alert("Failed to save collection data. Please try again.");
          }
          
          setWaitingForRfid(null);
          setRfidInput("");
        }
      } else if (e.key.length === 1) {
        setRfidInput(prev => prev + e.key);
      }
    };

    if (waitingForRfid) {
      window.addEventListener("keypress", handleKeyPress);
      return () => window.removeEventListener("keypress", handleKeyPress);
    }
  }, [waitingForRfid, rfidInput, rfidData, orders]);

  const getCategoryForPartNumber = (partNumber) => {
    const product = products.find(
      (p) => p.partNumber.trim().toLowerCase() === partNumber.trim().toLowerCase()
    );
    return product ? product.category : "N/A";
  };

  const openPopup = (order) => {
    const initialQuantities = {};
    order.cart.forEach((item) => {
      const uniqueKey = `${item.partNumber}_${item.id}`;
      
      // Check if there's already delivered quantity from database
      const deliveredItem = (order.deliveredItems || []).find(
        di => di.partNumber === item.partNumber && di.id === item.id
      );
      
      initialQuantities[uniqueKey] = deliveredItem ? deliveredItem.deliveredQty : 0;
    });
    setDeliveredQuantities(initialQuantities);
    setPopupOrder(order);
  };

  const updateStatus = async (id, reject = false) => {
    console.log("🔄 Updating order status:", id, reject ? "Reject" : "Approve");
    
    try {
      if (reject) {
        // Use existing decline endpoint
        const response = await fetch(`http://localhost:5000/api/order/${id}/decline`);
        if (!response.ok) {
          throw new Error('Failed to decline order');
        }
        console.log(`❌ Order ${id} declined`);
        
        // Refresh orders from backend
        await fetchOrdersFromBackend();
      } else {
        // For approval with delivery
        const order = orders.find(o => o.id === id);
        if (!order) {
          console.error("❌ Order not found for approval");
          return;
        }

        // Prepare delivered items data
        const deliveredItems = order.cart.map((item) => {
          const uniqueKey = `${item.partNumber}_${item.id}`;
          const deliveredQty = deliveredQuantities[uniqueKey] || 0;
          
          return {
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
            deliveredQty: deliveredQty,
            id: item.id
          };
        });

        // Calculate if all items are delivered
        const allDelivered = deliveredItems.every(item => item.deliveredQty === item.quantity);
        const status = allDelivered ? "Delivered" : "Partial";
        
        // Save delivery to database
        const deliveryResponse = await fetch(`http://localhost:5000/api/order/${id}/deliver`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliveredItems: deliveredItems,
            status: status
          })
        });

        if (!deliveryResponse.ok) {
          throw new Error('Failed to save delivery');
        }

        console.log(`✅ Order ${id} delivery saved with status: ${status}`);
        
        // Update stock locally
        updateStockLocally(order, deliveredQuantities);
        
        // Refresh orders from backend
        await fetchOrdersFromBackend();
      }
      
    } catch (err) {
      console.error("❌ Error updating order status:", err);
      alert("Failed to update order status. Please try again.");
    } finally {
      setPopupOrder(null);
      setDeliveredQuantities({});
    }
  };

  // Helper function to update stock in localStorage
  const updateStockLocally = (order, deliveredQuantities) => {
    try {
      const stockRaw = localStorage.getItem("savedStockData");
      let stockData = stockRaw ? JSON.parse(stockRaw) : [];

      if (order && order.cart) {
        console.log("📦 Updating stock for delivered items");
        
        order.cart.forEach((item) => {
          const uniqueKey = `${item.partNumber}_${item.id}`;
          const deliveredQty = deliveredQuantities[uniqueKey] || 0;
          
          if (!item.partNumber || deliveredQty <= 0) return;

          const index = stockData.findIndex(
            (s) => s.partNumber.toLowerCase() === item.partNumber.toLowerCase()
          );

          if (index !== -1) {
            const previousStock = stockData[index].currentStock;
            stockData[index].currentStock = Math.max(
              0,
              stockData[index].currentStock - deliveredQty
            );
            console.log(`📉 ${item.partNumber}: ${previousStock} → ${stockData[index].currentStock} (delivered: ${deliveredQty})`);
          }
        });

        localStorage.setItem("savedStockData", JSON.stringify(stockData));
        console.log("✅ Stock updated successfully after delivery");
        window.dispatchEvent(new Event('stockUpdated'));
      }
    } catch (err) {
      console.error("❌ Error updating stock:", err);
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log("📂 Uploading Excel file:", file.name);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        console.log("📊 Excel data parsed, rows:", jsonData.length);
        
        localStorage.setItem("uploadedExcel", JSON.stringify(jsonData));

        const productPartNumbers = products.map((p) => p.partNumber.trim().toLowerCase());

        const matched = jsonData
          .map((row) => {
            const partNum = (row["Material"] || "").toString().trim();
            if (!partNum || !productPartNumbers.includes(partNum.toLowerCase())) return null;

            const unrestricted = Number(
              row["Unrestricted"] ||
                row["unrestricted"] ||
                row["Unrestricted Stock"] ||
                row["Unrestricted Qty"] ||
                0
            );
            const valueUnrestricted = Number(row["Value Unrestricted"] || 0);
            const costPerUnit =
              unrestricted > 0 ? valueUnrestricted / unrestricted : 0;

            return { partNumber: partNum, costPerUnit, unrestricted };
          })
          .filter((i) => i !== null);

        console.log("✅ Matched products:", matched.length);
        setCostData(matched);

        const stockData = jsonData
          .map((row) => {
            const partNum = (row["Material"] || "").toString().trim();
            if (!partNum) return null;

            const normalizedPartNum = partNum.toLowerCase();
            if (!productPartNumbers.includes(normalizedPartNum)) {
              return null;
            }

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

        console.log("✅ Stock data processed:", stockData.length, "items");
        localStorage.setItem("savedStockData", JSON.stringify(stockData));
        
        window.dispatchEvent(new Event('stockUpdated'));

        const reorderItems = [];
        matched.forEach((excelItem) => {
          const product = products.find(
            (p) => p.partNumber === excelItem.partNumber
          );
          
          if (product) {
            const reorderLevel = product.min || 0;
            const currentStock = excelItem.unrestricted;
            
            if (currentStock <= reorderLevel) {
              reorderItems.push({
                partNumber: product.partNumber,
                description: product.description,
                currentStock: currentStock,
                min: product.min || 0,
                max: product.max || 0,
                rol: product.rol || reorderLevel,
                roq: product.roq || (product.max - currentStock),
                location: product.location,
                category: product.category,
                glCode: product.glCode,
                costCenter: product.costCenter
              });
            }
          }
        });

        console.log("⚠️ Products below reorder level:", reorderItems.length);
        setReorderProducts(reorderItems);
        
        if (reorderItems.length > 0) {
          alert(`✅ Excel uploaded successfully!\n⚠️ ${reorderItems.length} products are at or below reorder level!`);
        } else {
          alert(`✅ Excel uploaded successfully!\n✅ All products are above reorder level.`);
        }
        
      } catch (err) {
        console.error("Error reading Excel file:", err);
        alert("Error reading Excel file. Please check the file format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRfidExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log("📂 Uploading RFID Excel file:", file.name);
    setRfidFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        console.log("📊 RFID Excel data parsed, rows:", jsonData.length);
        
        const processedData = jsonData.map((row) => {
          const cardNumber = row["Card Number"] || row["Card"] || row["RFID"] || row["RFID Number"] || "";
          const idNumber = row["ID Number"] || row["ID"] || row["Employee ID"] || row["EmpID"] || "";
          const name = row["Name"] || row["Employee Name"] || row["Employee"] || "";
          
          return {
            cardNumber: cardNumber.toString().trim(),
            idNumber: idNumber.toString().trim(),
            name: name.toString().trim()
          };
        }).filter(item => item.cardNumber && item.idNumber && item.name);

        console.log("✅ RFID data processed:", processedData.length, "entries");
        setRfidData(processedData);
        
        alert(`✅ RFID data uploaded successfully!\n📊 ${processedData.length} entries loaded.`);
        setRfidUploadVisible(false);
        
      } catch (err) {
        console.error("Error reading RFID Excel file:", err);
        alert("Error reading RFID Excel file. Please check the file format.\nExpected columns: 'Card Number', 'ID Number', and 'Name'");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const totalOrders = orders.length;
  const pending = orders.filter((o) => o.status === "Pending" || o.status === "Approved").length;
  const delivered = orders.filter((o) => o.status === "Delivered").length;
  const rejected = orders.filter((o) => o.status === "Rejected").length;
  const partial = orders.filter((o) => o.status === "Partial").length;

  const monthlyData = Object.values(
    orders.reduce((acc, o) => {
      const dateStr = o.date || o.userDetails?.date || o.userDetails?.orderDate;
      const d = dateStr ? new Date(dateStr) : null;
      const month = d && !isNaN(d)
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : "Unknown";
      if (!acc[month]) acc[month] = { month, amount: 0, count: 0 };
      acc[month].amount += o.totalAmount || 0;
      acc[month].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => {
    if (a.month === "Unknown") return 1;
    if (b.month === "Unknown") return -1;
    return new Date(a.month) - new Date(b.month);
  });

  const zoneData = Object.values(
    orders.reduce((acc, o) => {
      const zone = o.userDetails?.zone || "Unknown";
      if (!acc[zone]) acc[zone] = { zone, count: 0 };
      acc[zone].count += 1;
      return acc;
    }, {})
  );

  const shopMonthlyCost = Object.values(
    orders.reduce((acc, o) => {
      const dateStr = o.date || o.userDetails?.date || o.userDetails?.orderDate;
      const d = dateStr ? new Date(dateStr) : null;
      const month = d && !isNaN(d)
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : "Unknown";
      
      if (!acc[month])
        acc[month] = {
          month,
          totalAmount: 0,
          cpu: 0,
          cpuTarget: 0,
          "Fixed Cost - Material": 0,
          "Variable Cost - Labour": 0,
          "PPE's (Personal Protective Equipments)": 0,
        };

      if (o.cart && o.cart.length > 0 && costData.length > 0) {
        o.cart.forEach((item) => {
          const match = costData.find((c) => c.partNumber === item.partNumber);
          if (match) {
            const productInfo = products.find(
              (p) => p.partNumber === item.partNumber
            );
            if (productInfo) {
              if (productInfo.category.includes("Material")) {
                acc[month]["Fixed Cost - Material"] +=
                  item.quantity * match.costPerUnit;
              } else if (productInfo.category.includes("Labour")) {
                acc[month]["Variable Cost - Labour"] +=
                  item.quantity * match.costPerUnit;
              } else {
                acc[month]["PPE's (Personal Protective Equipments)"] +=
                  item.quantity * match.costPerUnit;
              }
              acc[month].totalAmount += item.quantity * match.costPerUnit;
            }
          }
        });
      }

      if (cpuVolume) acc[month].cpu = cpuVolume > 0 ? acc[month].totalAmount / cpuVolume : 0;
      if (cpuTarget) acc[month].cpuTarget = Number(cpuTarget);

      return acc;
    }, {})
  ).sort((a, b) => {
    if (a.month === "Unknown") return 1;
    if (b.month === "Unknown") return -1;
    return new Date(a.month) - new Date(b.month);
  });

  // Get all unique zones
  const allZones = [...new Set(orders.map(o => o.userDetails?.zone || "Unknown"))].filter(z => z !== "Unknown").sort();

  // Generate zone-wise monthly cost data
  const getZoneMonthlyCost = (zone) => {
    const zoneOrders = orders.filter(o => (o.userDetails?.zone || "Unknown") === zone);
    
    return Object.values(
      zoneOrders.reduce((acc, o) => {
        const dateStr = o.date || o.userDetails?.date || o.userDetails?.orderDate;
        const d = dateStr ? new Date(dateStr) : null;
        const month = d && !isNaN(d)
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : "Unknown";
        
        if (!acc[month])
          acc[month] = {
            month,
            zone,
            totalAmount: 0,
            cpu: 0,
            cpuTarget: 0,
            "Fixed Cost - Material": 0,
            "Variable Cost - Labour": 0,
            "PPE's (Personal Protective Equipments)": 0,
          };

        if (o.cart && o.cart.length > 0 && costData.length > 0) {
          o.cart.forEach((item) => {
            const match = costData.find((c) => c.partNumber === item.partNumber);
            if (match) {
              const productInfo = products.find(
                (p) => p.partNumber === item.partNumber
              );
              if (productInfo) {
                if (productInfo.category.includes("Material")) {
                  acc[month]["Fixed Cost - Material"] +=
                    item.quantity * match.costPerUnit;
                } else if (productInfo.category.includes("Labour")) {
                  acc[month]["Variable Cost - Labour"] +=
                    item.quantity * match.costPerUnit;
                } else {
                  acc[month]["PPE's (Personal Protective Equipments)"] +=
                    item.quantity * match.costPerUnit;
                }
                acc[month].totalAmount += item.quantity * match.costPerUnit;
              }
            }
          });
        }

        const zoneConfig = zoneWiseCpuData[zone] || {};
        if (zoneConfig.volume) acc[month].cpu = zoneConfig.volume > 0 ? acc[month].totalAmount / zoneConfig.volume : 0;
        if (zoneConfig.target) acc[month].cpuTarget = Number(zoneConfig.target);

        return acc;
      }, {})
    ).sort((a, b) => {
      if (a.month === "Unknown") return 1;
      if (b.month === "Unknown") return -1;
      return new Date(a.month) - new Date(b.month);
    });
  };

  const allCategories = [...new Set(
    orders.flatMap(o => 
      o.cart.map(item => getCategoryForPartNumber(item.partNumber))
    )
  )].filter(cat => cat !== "N/A").sort();

  const filteredOrders = orders.filter((o) => {
    const orderDate = o.date || o.userDetails?.date || o.userDetails?.orderDate;
    const formattedOrderDate = formatDate(orderDate);
    const formattedFilterDate = formatDate(filterDate);
    const dateMatch = filterDate ? formattedOrderDate === formattedFilterDate : true;
    const statusMatch = filterStatus === "All" ? true : o.status === filterStatus;
    
    const categoryMatch = filterCategory === "All" ? true : 
      o.cart.some(item => getCategoryForPartNumber(item.partNumber) === filterCategory);
    
    return dateMatch && statusMatch && categoryMatch;
  });

  const downloadFilteredExcel = () => {
    if (!filteredOrders.length) {
      alert("No data to export!");
      return;
    }

    const exportData = filteredOrders.flatMap((o) =>
      o.cart.map((i) => {
        const productInfo = products.find((p) => p.partNumber === i.partNumber);
        
        // Get issued quantity from deliveredItems
        let issuedQty = 0;
        if (o.deliveredItems && o.deliveredItems.length > 0) {
          const deliveredItem = o.deliveredItems.find(
            (di) => di.partNumber === i.partNumber && di.id === i.id
          );
          if (deliveredItem) {
            issuedQty = deliveredItem.deliveredQty || 0;
          }
        }
        
        // Get collection history
        const collectionInfo = (o.collectionHistory || [])
          .map(entry => `${entry.type}: ${entry.collectedBy} (${entry.timestamp})`)
          .join(" | ") || "N/A";
        
        return {
          Employee: o.userDetails?.name || "N/A",
          EmpID: o.userDetails?.empId || "N/A",
          Department: o.userDetails?.dept || "N/A",
          Zone: o.userDetails?.zone || "N/A",
          Date: formatDate(o.date || o.userDetails?.date || o.userDetails?.orderDate),
          Category: getCategoryForPartNumber(i.partNumber),
          PartNumber: i.partNumber,
          Description: i.description,
          Quantity: i.quantity,
          IssuedQuantity: issuedQty,
          Location: productInfo ? productInfo.location : "N/A",
          GLCode: productInfo ? productInfo.glCode : "N/A",
          CostCenter: productInfo ? productInfo.costCenter : "N/A",
          Status: o.status,
          CollectionHistory: collectionInfo,
        };
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Orders");
    XLSX.writeFile(workbook, "FilteredOrders.xlsx");
  };

  const hasFullCollection = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    const history = order?.collectionHistory;
    if (!history || history.length === 0) return false;
    return history.some(entry => entry.type === "Full");
  };

  if (showZoneGraphs) {
    return (
      <div className="dashboard">
        <div className="renault-logo-top">
          <img src="/renault-group-logo.png" alt="Renault" />
        </div>
        <div className="renault-logo-bg"></div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingLeft:"750px", paddingTop:"14px" }}>
          <h1>📊 Zone-Wise Monthly Cost Graphs</h1>
          <button 
            onClick={() => setShowZoneGraphs(false)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(3, 1fr)", 
          gap: "30px",
          padding: "20px"
        }}>
          {allZones.map((zone, idx) => {
            const zoneData = getZoneMonthlyCost(zone);
            const zoneConfig = zoneWiseCpuData[zone] || {};
            
            return (
              <div key={idx} style={{
                border: "2px solid #ddd",
                borderRadius: "10px",
                padding: "15px",
                backgroundColor: "#fff",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  marginBottom: "10px"
                }}>
                  <h3 style={{ margin: 0, color: "#333" }}>{zone}</h3>
                  <button
                    onClick={() => setCurrentZoneForCpu(zone)}
                    style={{
                      padding: "5px 10px",
                      backgroundColor: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "bold"
                    }}
                  >
                    ⚙ Set CPU
                  </button>
                </div>
                
                {zoneConfig.volume && (
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                    Volume: <strong>{zoneConfig.volume}</strong> | Target: <strong>{zoneConfig.target}</strong>
                  </div>
                )}

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={zoneData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" style={{ fontSize: "10px" }} />
                    <YAxis style={{ fontSize: "10px" }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "13px" }} />
                    <Bar dataKey="Fixed Cost - Material" stackId="a" fill="#8884d8" />
                    <Bar dataKey="Variable Cost - Labour" stackId="a" fill="#82ca9d" />
                    <Bar
                      dataKey="PPE's (Personal Protective Equipments)"
                      stackId="a"
                      fill="#ffc658"
                    />
                    {zoneConfig.volume && <Bar dataKey="cpu" fill="#ff4d4f" />}
                    {zoneConfig.target && (
                      <Line
                        type="monotone"
                        dataKey="cpuTarget"
                        stroke="#000"
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>

        {/* Zone-specific CPU popup */}
        {currentZoneForCpu && (
          <div className="popup-overlay" onClick={() => setCurrentZoneForCpu(null)}>
            <div className="popup" onClick={(e) => e.stopPropagation()}>
              <h3>⚙ CPU Volume & Target for {currentZoneForCpu}</h3>
              <label>Volume:</label>
              <input
                type="number"
                value={zoneWiseCpuData[currentZoneForCpu]?.volume || ""}
                onChange={(e) => {
                  const newData = { ...zoneWiseCpuData };
                  if (!newData[currentZoneForCpu]) newData[currentZoneForCpu] = {};
                  newData[currentZoneForCpu].volume = e.target.value;
                  setZoneWiseCpuData(newData);
                }}
              />
              <label>Target:</label>
              <input
                type="number"
                value={zoneWiseCpuData[currentZoneForCpu]?.target || ""}
                onChange={(e) => {
                  const newData = { ...zoneWiseCpuData };
                  if (!newData[currentZoneForCpu]) newData[currentZoneForCpu] = {};
                  newData[currentZoneForCpu].target = e.target.value;
                  setZoneWiseCpuData(newData);
                }}
              />
              <div className="filter-actions">
                <button onClick={() => setCurrentZoneForCpu(null)}>Apply</button>
                <button onClick={() => setCurrentZoneForCpu(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="renault-logo-top">
        <img src="/renault-group-logo.png" alt="Renault" />
      </div>
      <div className="renault-logo-bg"></div>
      
      <h1>📊 Trim Store Dashboard</h1>

      <div className="summary-cards">
        <div className="summary-card total">Total Orders: {totalOrders}</div>
        <div className="summary-card pending">Pending: {pending}</div>
        <div className="summary-card partial">Partial: {partial}</div>
        <div className="summary-card approved">Delivered: {delivered}</div>
        <div className="summary-card rejected">Rejected: {rejected}</div>
      </div>

      <div className="button-row">
        <button className="action-btn filter" onClick={() => setFilterVisible(true)}>
          🔍 Filter
        </button>
        <button className="action-btn upload" onClick={() => setUploadVisible(true)}>
          📂 Upload Excel
        </button>
        <button
          className="action-btn stock"
          onClick={() => navigate("/stock-management")}
        >
          📊 Stock Management
        </button>
        <button className="action-btn reorder" onClick={() => setReorderVisible(true)}>
          📦 Reorder Level ({reorderProducts.length})
        </button>
        <button 
          className="action-btn" 
          onClick={() => setRfidUploadVisible(true)}
          style={{ backgroundColor: "#6f42c1" }}
        >
          📇 Upload RFID Data
        </button>
        <button className="action-btn cpu" onClick={() => setCpuPopupVisible(true)}>
          ⚙ PRODUCTION VOLUME AND TARGET DATA
        </button>
        <button 
          className="action-btn" 
          onClick={() => setShowZoneGraphs(true)}
          style={{ backgroundColor: "#28a745" }}
        >
          📈 Zone Wise Graphs
        </button>
      </div>

      {rfidUploadVisible && (
        <div className="popup-overlay" onClick={() => setRfidUploadVisible(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <h3>📇 Upload RFID Data</h3>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
              Excel should contain columns: <strong>Card Number, ID Number, Name</strong>
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={handleRfidExcelUpload} />
            {rfidFileName && <p>📄 Selected File: <strong>{rfidFileName}</strong></p>}
            {rfidData.length > 0 && (
              <p style={{ color: "#28a745", fontWeight: "bold" }}>
                ✅ {rfidData.length} RFID entries loaded
              </p>
            )}
            <div className="filter-actions">
              <button onClick={() => setRfidUploadVisible(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {cpuPopupVisible && (
        <div className="popup-overlay" onClick={() => setCpuPopupVisible(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <h3>⚙ CPU Volume & Target</h3>
            <label>Volume:</label>
            <input
              type="number"
              value={cpuVolume}
              onChange={(e) => setCpuVolume(e.target.value)}
            />
            <label>Target:</label>
            <input
              type="number"
              value={cpuTarget}
              onChange={(e) => setCpuTarget(e.target.value)}
            />
            <div className="filter-actions">
              <button onClick={() => setCpuPopupVisible(false)}>Apply</button>
              <button onClick={() => setCpuPopupVisible(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {uploadVisible && (
        <div className="popup-overlay" onClick={() => setUploadVisible(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <h3>📂 Upload Excel File</h3>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
              Excel should contain columns: <strong>Material, Material Description, Unrestricted</strong>
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
            {selectedFileName && <p>📄 Selected File: <strong>{selectedFileName}</strong></p>}
            <div className="filter-actions">
              <button onClick={() => setUploadVisible(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {filterVisible && (
        <div className="filter-overlay" onClick={() => setFilterVisible(false)}>
          <div className="filter-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Filter Orders</h3>
            <label>Date:</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            <label>Status:</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Partial</option>
              <option>Delivered</option>
              <option>Rejected</option>
            </select>
            <label>Category:</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option>All</option>
              {allCategories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                onClick={() => setFilterVisible(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#28a745",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Apply
              </button>
              <button
                onClick={() => { setFilterDate(""); setFilterStatus("All"); setFilterCategory("All"); setFilterVisible(false); }}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Reset
              </button>
            </div>

            <div style={{ marginTop: "10px" }}>
              <button
                onClick={downloadFilteredExcel}
                style={{
                  width: "100%",
                  backgroundColor: "#17a2b8",
                  color: "#fff",
                  padding: "10px",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                ⬇ Download Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {reorderVisible && (
        <div className="popup-overlay">
          <div className="popup">
            <h3>📦 Products Below Reorder Level</h3>
            {reorderProducts.length === 0 ? (
              <p>✅ All products are above reorder level.</p>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {reorderProducts.map((p, idx) => (
                  <div key={idx} className="reorder-item" style={{ 
                    padding: "10px", 
                    margin: "5px 0", 
                    backgroundColor: "#f8d7da",
                    borderRadius: "5px",
                    border: "1px solid #f5c6cb"
                  }}>
                    <strong>{p.partNumber}</strong> - {p.description}
                    <br />
                    📊 Current Stock: <span style={{ color: "red", fontWeight: "bold" }}>{p.currentStock}</span>  
                    <br />
                    🔄 ROL: <span style={{ color: "orange", fontWeight: "bold" }}>{p.rol}</span> | 
                    📦 ROQ: <span style={{ color: "green", fontWeight: "bold" }}>{p.roq}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setReorderVisible(false)} style={{ marginTop: "15px" }}>Close</button>
          </div>
        </div>
      )}

      <div className="graph-section" style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>Monthly Orders Count</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>Orders by Zone</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={zoneData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="zone" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#17a2b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: 1, minWidth: 300, marginTop: 0 }}>
          <h3>Shop-wise Monthly Cost</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={shopMonthlyCost}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Fixed Cost - Material" stackId="a" fill="#8884d8" />
              <Bar dataKey="Variable Cost - Labour" stackId="a" fill="#82ca9d" />
              <Bar
                dataKey="PPE's (Personal Protective Equipments)"
                stackId="a"
                fill="#ffc658"
              />
              {cpuVolume && <Bar dataKey="cpu" fill="#ff4d4f" />}
              {cpuTarget && (
                <Line
                  type="monotone"
                  dataKey="cpuTarget"
                  stroke="#000"
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Emp ID</th>
              <th>Dept</th>
              <th>Zone</th>
              <th>Date</th>
              <th>Category</th>
              <th>Items</th>
              <th>Location</th>
              <th>Status</th>
              <th>Received By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => {
              const displayDate = formatDate(o.date || o.userDetails?.date || o.userDetails?.orderDate);
              
              const orderCategories = [...new Set(o.cart.map(item => getCategoryForPartNumber(item.partNumber)))];
              
              const fullCollectionMarked = hasFullCollection(o.id);
              
              // Check if buttons should be enabled - only for "Approved" status
              const isApproved = o.status === "Approved" || o.status === "Partial";     
              
              return (
                <tr key={o.id}>
                  <td>{o.userDetails?.name || "N/A"}</td>
                  <td>{o.userDetails?.empId || "N/A"}</td>
                  <td>{o.userDetails?.dept || "N/A"}</td>
                  <td>{o.userDetails?.zone || "N/A"}</td>
                  <td>{displayDate}</td>
                  <td>
                    {orderCategories.map((cat, idx) => (
                      <div key={idx}>{cat}</div>
                    ))}
                  </td>
                  <td>
                    {o.cart.map((i) => (
                      <div key={i.id}>
                        {i.partNumber} - {i.description} (x{i.quantity})
                      </div>
                    ))}
                  </td>
                  <td>
                    {o.cart.map((i) => {
                      const productInfo = products.find((p) => p.partNumber === i.partNumber);
                      return (
                        <div key={i.id}>
                          {i.partNumber} - {productInfo ? productInfo.location : "N/A"}
                        </div>
                      );
                    })}
                  </td>
                  <td>{o.status}</td>
                  <td>
                    {(() => {
                      const history = o.collectionHistory || [];
                      
                      if (history.length > 0) {
                        return (
                          <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            gap: "5px",
                            maxWidth: "250px" 
                          }}>
                            {history.map((entry, idx) => (
                              <div 
                                key={idx}
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  backgroundColor: entry.type === "Partial" ? "#fff3cd" : "#d4edda",
                                  border: entry.type === "Partial" ? "1px solid #ffc107" : "1px solid #28a745",
                                  color: "#000",
                                }}
                              >
                                <div style={{ fontWeight: "bold" }}>
                                  {entry.type === "Partial" ? "🟡 Partial" : "🟢 Full"} Collection
                                </div>
                                <div>{entry.collectedBy}</div>
                                <div style={{ fontSize: "10px", color: "#666" }}>
                                  {entry.timestamp}
                                </div>
                              </div>
                            ))}
                            {!fullCollectionMarked && (o.status === "Partial" || o.status === "Delivered") && (
                              <button
                                className="rfid-btn"
                                onClick={() => {
                                  setWaitingForRfid(o.id);
                                  setRfidInput("");
                                }}
                                style={{
                                  backgroundColor: waitingForRfid === o.id ? "#ffc107" : "#007bff",
                                  color: "#fff",
                                  border: "none",
                                  padding: "5px 10px",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                  marginTop: "5px",
                                }}
                              >
                                {waitingForRfid === o.id ? "⏳ Waiting..." : "📡 Scan Again"}
                              </button>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <button
                            className="rfid-btn"
                            onClick={() => {
                              if (o.status === "Delivered" || o.status === "Partial") {
                                setWaitingForRfid(o.id);
                                setRfidInput("");
                              }
                            }}
                            disabled={o.status !== "Delivered" && o.status !== "Partial"}
                            style={{
                              backgroundColor: 
                                (o.status !== "Delivered" && o.status !== "Partial") ? "#6c757d" : 
                                waitingForRfid === o.id ? "#ffc107" : "#007bff",
                              color: "#fff",
                              border: "none",
                              padding: "5px 10px",
                              borderRadius: "4px",
                              cursor: (o.status !== "Delivered" && o.status !== "Partial") ? "not-allowed" : "pointer",
                              fontWeight: "bold",
                              opacity: (o.status !== "Delivered" && o.status !== "Partial") ? 0.6 : 1,
                            }}
                          >
                            {waitingForRfid === o.id ? "⏳ Waiting..." : "📡 Scan ID"}
                          </button>
                        );
                      }
                    })()}
                  </td>
                  <td>
                    <button
                      className={`approve-btn ${
                        o.status === "Partial"
                          ? "partial"
                          : o.status === "Delivered"
                          ? "delivered"
                          : ""
                      }`}
                      onClick={() => openPopup(o)}
                      disabled={!isApproved}
                      style={{
                        opacity: !isApproved ? 0.5 : 1,
                        cursor: !isApproved ? "not-allowed" : "pointer"
                      }}
                    >
                      {o.status === "Partial"
                        ? "Partial"
                        : o.status === "Delivered"
                        ? "Delivered"
                        : "Approve"}
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => updateStatus(o.id, true)}
                      disabled={!isApproved}
                      style={{
                        opacity: !isApproved ? 0.5 : 1,
                        cursor: !isApproved ? "not-allowed" : "pointer"
                      }}
                    >
                      ❌ Reject
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {popupOrder && (
        <div className="popup-overlay">
          <div className="popup">
            <h3>Select Delivered Quantities</h3>
            {popupOrder.cart.map((item, index) => {
              const uniqueKey = `${item.partNumber}_${item.id}`;
              return (
                <div key={uniqueKey} className="checkbox-item">
                  <label>
                    {item.partNumber} - {item.description} (Requested: {item.quantity})
                  </label>

                  {item.quantity === 1 ? (
                    <input
                      type="checkbox"
                      checked={deliveredQuantities[uniqueKey] === 1}
                      onChange={(e) =>
                        setDeliveredQuantities((prev) => ({
                          ...prev,
                          [uniqueKey]: e.target.checked ? 1 : 0,
                        }))
                      }
                      style={{ marginLeft: "10px" }}
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={deliveredQuantities[uniqueKey] || 0}
                      onChange={(e) =>
                        setDeliveredQuantities((prev) => ({
                          ...prev,
                          [uniqueKey]: Number(e.target.value),
                        }))
                      }
                      style={{ width: "60px", marginLeft: "10px" }}
                    />
                  )}
                </div>
              );
            })}
            <button onClick={() => updateStatus(popupOrder.id)}>Confirm Delivery</button>
            <button onClick={() => setPopupOrder(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}