import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  where,
  query,
  onSnapshot,
  updateDoc,
  orderBy, // Added for sorting
  Timestamp // Added for createdAt
} from "firebase/firestore";
import { db } from "./firebase";
import { Chart, registerables } from 'chart.js/auto'; // Import Chart.js
import "./App.css";
import { Settings } from "lucide-react";

Chart.register(...registerables); // Register all Chart.js components
const CURRENCY = {
  symbol: "₹",
  code: "INR"
};


//Monthly Overview Diagram Component
const MonthlyOverviewDiagram = ({ transactions, currentMonthDate }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!transactions.length && chartRef.current) { // Handle case with no transactions
        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }
        const ctx = chartRef.current.getContext("2d");
        // Optionally, display a message or an empty state chart
        ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("No transaction data for this month.", chartRef.current.width / 2, chartRef.current.height / 2);
        return;
    }
    if (!chartRef.current) return;


    const month = currentMonthDate.getMonth();
    const year = currentMonthDate.getFullYear();

    const monthlyIncome = transactions
      .filter(t => {
        const tDate = new Date(t.date || (t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt));
        return t.type === "income" && tDate.getMonth() === month && tDate.getFullYear() === year;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const monthlyExpense = transactions
      .filter(t => {
        const tDate = new Date(t.date || (t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt));
        return t.type === "expense" && tDate.getMonth() === month && tDate.getFullYear() === year;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Income", "Expense"],
        datasets: [
          {
            label: `Overview for ${currentMonthDate.toLocaleString('default', { month: 'long' })} ${year}`,
            data: [monthlyIncome, monthlyExpense],
            backgroundColor: [
              "rgba(118, 200, 192, 0.6)", // --income with alpha
              "rgba(255, 107, 107, 0.6)", // --expense with alpha
            ],
            borderColor: [
              "rgb(118, 200, 192)",
              "rgb(255, 107, 107)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return CURRENCY.symbol + value;
              }
            }
          },
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
     return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [transactions, currentMonthDate]);

  return (
    <div className="monthly-overview-container card-style">
      <h2>Monthly Financial Overview</h2>
      <p>Showing data for: {currentMonthDate.toLocaleString('default', { month: 'long' })} {currentMonthDate.getFullYear()}</p>
      <div style={{ height: "300px", position: "relative" }}>
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

//Bucket List Item Component
const BucketListItem = ({ item, onUpdate, onDelete, onToggleComplete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editNotes, setEditNotes] = useState(item.notes || "");

  const handleSave = () => {
    onUpdate(item.id, { text: editText, notes: editNotes });
    setIsEditing(false);
  };

  return (
    <div className={`bucket-list-item ${item.isCompleted ? "completed" : ""}`}>
      {isEditing ? (
        <div className="bucket-item-edit-form">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Item name"
          />
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes (optional)"
          />
          <div className="actions">
            <button onClick={handleSave} className="save-btn">Save</button>
            <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="bucket-item-view">
          <div className="item-content" onClick={() => onToggleComplete(item.id, !item.isCompleted)}>
            <input type="checkbox" checked={item.isCompleted} onChange={() => {}} className="item-checkbox"/> {/* Added onChange to checkbox for accessibility though click is on parent */}
            <span className="item-text">{item.text}</span>
          </div>
          {item.notes && <p className="item-notes"><em>Notes:</em> {item.notes}</p>}
          <div className="actions">
            <button onClick={() => setIsEditing(true)} className="edit-btn">✏️</button>
            <button onClick={() => onDelete(item.id)} className="delete-btn">🗑️</button>
          </div>
        </div>
      )}
    </div>
  );
};


// Main App Component
const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode ? JSON.parse(savedMode) : false;
  });
  const [showMenu, setShowMenu] = useState(false);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [transactionType, setTransactionType] = useState("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionParty, setTransactionParty] = useState(""); // For "Received From" / "Paid To"
  const [selectedTags, setSelectedTags] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterTag, setFilterTag] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [statistics, setStatistics] = useState({
    totalIncome: 0,
    totalExpense: 0,
    topExpenseCategories: []
  });
  const [activeSection, setActiveSection] = useState("overview"); // Default to overview

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [activeView, setActiveView] = useState("dashboard"); // 'dashboard', 'overview', 'bucketlist'

  // Bucket List State
  const [bucketListItems, setBucketListItems] = useState([]);
  const [newBucketItemText, setNewBucketItemText] = useState("");
  const [newBucketItemNotes, setNewBucketItemNotes] = useState("");


  useEffect(() => {
    setLoading(true);
    // Transactions
    const transactionsQuery = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const transactionsUnsub = onSnapshot(transactionsQuery, (snapshot) => {
        const transactionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTransactions(transactionsData);
        calculateBalance(transactionsData);
        calculateStatistics(transactionsData);
      }, (error) => {
        console.error("Error fetching transactions:", error);
        setLoading(false);
      }
    );

    // Tags
    const tagsUnsub = onSnapshot(collection(db, "tags"), (snapshot) => {
        const tagsData = snapshot.docs.map(doc => doc.data().name);
        setTags(tagsData);
      }, (error) => {
        console.error("Error fetching tags:", error);
      }
    );
    // Bucket List Items
    const bucketListQuery = query(collection(db, "bucketListItems"), orderBy("createdAt", "desc"));
    const bucketListUnsub = onSnapshot(bucketListQuery, (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBucketListItems(itemsData);
      }, (error) => {
        console.error("Error fetching bucket list items:", error);
      }
    );
    Promise.all([
        getDocs(transactionsQuery), 
    ]).then(() => {
        setLoading(false);
    }).catch(() => {
        setLoading(false); // also set loading false on error
    });
    return () => {
      transactionsUnsub();
      tagsUnsub();
      bucketListUnsub();
    };
  }, []);
  
  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
    document.body.classList.remove(isDarkMode ? 'light' : 'dark');
    document.body.classList.add(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const calculateStatistics = (transactionsData) => {
    const totalIncome = transactionsData.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = transactionsData.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expensesByTag = {};
    transactionsData.filter(t => t.type === "expense").forEach(transaction => {
        if (transaction.tags && transaction.tags.length > 0) {
          transaction.tags.forEach(tag => {
            expensesByTag[tag] = (expensesByTag[tag] || 0) + Number(transaction.amount || 0);
          });
        } else {
          expensesByTag["Uncategorized"] = (expensesByTag["Uncategorized"] || 0) + Number(transaction.amount || 0);
        }
      });
    const topExpenseCategories = Object.entries(expensesByTag).map(([tag, amount]) => ({ tag, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5);
    setStatistics({ totalIncome, totalExpense, topExpenseCategories });
  };

  const calculateBalance = (transactionsData) => {
    const total = transactionsData.reduce((acc, transaction) => transaction.type === "income" ? acc + Number(transaction.amount || 0) : acc - Number(transaction.amount || 0), 0);
    setBalance(total);
  };


  const toggleTheme = () => setIsDarkMode(prev => !prev);
  const handleTagChange = (e) => setNewTag(e.target.value);

  const addTag = async () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      try {
        await addDoc(collection(db, "tags"), { name: newTag.trim() });
        setNewTag("");
      } catch (error) { console.error("Error adding tag:", error); }
    }
  };

  const removeTag = async (tagToRemove) => {
    try {
      const q = query(collection(db, "tags"), where("name", "==", tagToRemove));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(doc(db, "tags", docSnapshot.id));
      });
    } catch (error) { console.error("Error removing tag:", error); }
  };

  const handleTransactionTypeChange = (type) => setTransactionType(type);

  const handleSubmitTransaction = async () => {
    if (amount && !isNaN(amount) && description.trim()) {
      const transactionData = {
        type: transactionType,
        amount: Number(amount),
        description: description.trim(),
        tags: selectedTags,
        date: selectedDate.toISOString(),
        party: transactionParty.trim() || null, 
      };

      try {
        if (editingTransaction) {
          await updateDoc(doc(db, "transactions", editingTransaction.id), {
            ...transactionData,
            updatedAt: Timestamp.now()
          });
          setEditingTransaction(null);
        } else {
          await addDoc(collection(db, "transactions"), {
            ...transactionData,
            createdAt: Timestamp.now()
          });
        }
        setAmount("");
        setDescription("");
        setTransactionParty("");
        setSelectedTags([]);
      } catch (error) {
        console.error("Error with transaction:", error);
      }
    }
  };

  const editTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setAmount(transaction.amount);
    setDescription(transaction.description);
    setSelectedTags(transaction.tags || []);
    setTransactionParty(transaction.party || "");
    setSelectedDate(new Date(transaction.date || (transaction.createdAt?.toDate ? transaction.createdAt.toDate() : transaction.createdAt) ));
    setActiveView("dashboard"); 
    const formContainer = document.querySelector('.transaction-form-container');
    if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const deleteTransaction = async (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteDoc(doc(db, "transactions", id));
      } catch (error) { console.error("Error deleting transaction:", error); }
    }
  };

  const handleTagSelect = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleFilterChange = (type) => setFilterType(type);
  const handleFilterTagChange = (tag) => setFilterTag(prev => prev === tag ? "" : tag);

  // CORRECTED handleDateRangeChange
  const handleDateRangeChange = (e) => {
    const { name, value } = e.target; // FIX: Destructure name and value
    setDateRange(prev => ({
      ...prev,
      [name]: value // FIX: Use destructured name
    }));
  };

  const resetFilters = () => {
    setFilterType("all");
    setFilterTag("");
    setDateRange({ start: "", end: "" });
  };

  const toggleCalendarVisibility = () => setCalendarVisible(prev => !prev);
  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };
  const changeMonth = (offset) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handleAddBucketItem = async () => {
    if (newBucketItemText.trim() === "") return;
    try {
      await addDoc(collection(db, "bucketListItems"), {
        text: newBucketItemText.trim(),
        notes: newBucketItemNotes.trim() || null,
        isCompleted: false,
        createdAt: Timestamp.now()
      });
      setNewBucketItemText("");
      setNewBucketItemNotes("");
    } catch (error) {
      console.error("Error adding bucket list item:", error);
    }
  };

  const handleUpdateBucketItem = async (id, updates) => {
    try {
      await updateDoc(doc(db, "bucketListItems", id), updates);
    } catch (error) {
      console.error("Error updating bucket list item:", error);
    }
  };

  const handleDeleteBucketItem = async (id) => {
    if (window.confirm("Delete this bucket list item?")) {
      try {
        await deleteDoc(doc(db, "bucketListItems", id));
      } catch (error) {
        console.error("Error deleting bucket list item:", error);
      }
    }
  };
  const handleToggleBucketItemComplete = async (id, isCompleted) => {
     try {
      await updateDoc(doc(db, "bucketListItems", id), { isCompleted });
    } catch (error) {
      console.error("Error toggling bucket list item completion:", error);
    }
  };

  const renderCalendar = () => { 
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    const transactionsThisMonth = transactions.filter(t => {
      const tDateObj = t.date ? new Date(t.date) : (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
      return tDateObj.getMonth() === month && tDateObj.getFullYear() === year;
    });
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selectedDate.getDate() === day && 
                        selectedDate.getMonth() === month && 
                        selectedDate.getFullYear() === year;
      
      const dateForDay = new Date(year, month, day);
      const hasTransactions = transactionsThisMonth.some(t => {
         const tDateObj = t.date ? new Date(t.date) : (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
         return tDateObj.getFullYear() === dateForDay.getFullYear() &&
                tDateObj.getMonth() === dateForDay.getMonth() &&
                tDateObj.getDate() === dateForDay.getDate();
      });
      
      days.push(
        <div 
          key={day} 
          className={`calendar-day ${isSelected ? 'selected' : ''} ${hasTransactions ? 'has-transactions' : ''}`}
          onClick={() => handleDateClick(day)}
        >
          {day}
          {hasTransactions && <span className="dot"></span>}
        </div>
      );
    }
     return (
      <div className="calendar">
        <div className="calendar-header">
          <button onClick={() => changeMonth(-1)}>←</button>
          <h3>{monthNames[month]} {year}</h3>
          <button onClick={() => changeMonth(1)}>→</button>
        </div>
        <div className="calendar-days-header">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        <div className="calendar-days">{days}</div>
      </div>
    );
  };

  const formatDate = (dateInput) => {
    let date;
    if (!dateInput) return "No Date";

    if (dateInput instanceof Timestamp) {
        date = dateInput.toDate();
    } else if (typeof dateInput === 'string' || dateInput instanceof Date) {
        date = new Date(dateInput);
    } else {
        return "Invalid Date Input"; 
    }

    if (isNaN(date.getTime())) { 
        return "Invalid Date";
    }

    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  };
  const formatAmount = (amountVal) => {
    const num = Number(amountVal);
    return !isNaN(num) ? num.toFixed(2) : "0.00";
  };
  
  // Commenting out unused mobile menu toggle
  // const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  const filteredTransactions = transactions.filter(transaction => {
    if (filterType !== "all" && transaction.type !== filterType) return false;
    if (filterTag && (!transaction.tags || !transaction.tags.includes(filterTag))) return false;
    
    const transactionDateRaw = transaction.date || transaction.createdAt;
    if (!transactionDateRaw) return true; // Or false, depending on how you want to handle missing dates
    
    const transactionDate = transactionDateRaw.toDate ? transactionDateRaw.toDate() : new Date(transactionDateRaw);

    if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        // Reset time part of startDate for day-based comparison
        startDate.setHours(0,0,0,0);
        if (transactionDate < startDate) return false;
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); 
      if (transactionDate > endDate) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        Loading My-Money...
      </div>
    );
  }

  // function app({ activeView, setActiveView, activeSection, setActiveSection }) {
  //   const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="app">
     <nav className="navbar">
  <div className="navbar-brand">EXPANSIO</div>

  <div className="navbar-settings">
    <button className="gear-button" onClick={() => setShowMenu(!showMenu)}>⚙️</button>

    {showMenu && (
      <div className="dropdown-menu">
        <button onClick={() => setActiveView("dashboard")}>📊 Dashboard</button>
        <button onClick={() => setActiveView("overview")}>📅 Monthly Overview</button>
        <button onClick={() => setActiveView("bucketlist")}>🎯 Bucket List</button>
        <button onClick={() => setActiveSection("transactions")}>💳 Transactions</button>
      </div>
    )}
  </div>
</nav>


      {/* Sidebar Balance Summary */}
      <div className="sidebar">
        <div className="balance-card card-style">
          <h3>Total Balance</h3>
          <div className="balance-amount">
            <span>{CURRENCY.symbol}{formatAmount(balance)}</span>
          </div>
          <div className="balance-summary">
            <div className="income-summary">
              <span>Income</span>
              <span>{CURRENCY.symbol}{formatAmount(statistics.totalIncome)}</span>
            </div>
            <div className="expense-summary">
              <span>Expense</span>
              <span>{CURRENCY.symbol}{formatAmount(statistics.totalExpense)}</span>
            </div>
          </div>
        </div>
      </div>
  
      {/* Main Content */}
      <div className="main-content">
        {/* Dashboard View */}
        {activeView === "dashboard" && (
          <>
            <div className="calendar-container card-style">
              <div className="calendar-toggle" onClick={toggleCalendarVisibility}>
                <h2>Calendar {calendarVisible ? "▼" : "▶"}</h2>
                <span>{selectedDate.toDateString()}</span>
              </div>
              {calendarVisible && renderCalendar()}
            </div>
  
            <div className="transaction-form-container card-style">
              <h2>{editingTransaction ? "Edit Transaction" : "New Transaction"}</h2>
  
              <div className="type-toggle">
                <button
                  className={`toggle-btn ${transactionType === "income" ? "active income" : ""}`}
                  onClick={() => handleTransactionTypeChange("income")}
                >
                  💰 Income
                </button>
                <button
                  className={`toggle-btn ${transactionType === "expense" ? "active expense" : ""}`}
                  onClick={() => handleTransactionTypeChange("expense")}
                >
                  💸 Expense
                </button>
              </div>
  
              <div className="form-group">
                <label>Amount ({CURRENCY.symbol})</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" />
              </div>
  
              <div className="form-group">
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter description" className="description-input" />
              </div>
  
              <button className="submit-btn" onClick={handleSubmitTransaction}>
                {editingTransaction ? "Update Transaction" : transactionType === "income" ? "Add Income" : "Add Expense"}
              </button>
  
              {editingTransaction && (
                <button className="cancel-btn" onClick={() => {
                  setEditingTransaction(null);
                  setAmount("");
                  setDescription("");
                  setTransactionParty("");
                  setSelectedTags([]);
                  setTransactionType("income");
                }}>
                  Cancel Editing
                </button>
              )}
            </div>
  
            {activeSection === "transactions" && (
              <div className="transactions-container card-style">
                <div className="transactions-header">
                  <h2>Transactions</h2>
                  <div className="filters">
                    <div className="filter-group">
                      <span>Type:</span>
                      <button className={`filter-btn ${filterType === "all" ? "active" : ""}`} onClick={() => handleFilterChange("all")}>All</button>
                      <button className={`filter-btn ${filterType === "income" ? "active income" : ""}`} onClick={() => handleFilterChange("income")}>Income</button>
                      <button className={`filter-btn ${filterType === "expense" ? "active expense" : ""}`} onClick={() => handleFilterChange("expense")}>Expense</button>
                    </div>
                    <div className="filter-group">
                      <span>Date:</span>
                      <input type="date" name="start" value={dateRange.start} onChange={handleDateRangeChange} />
                      <input type="date" name="end" value={dateRange.end} onChange={handleDateRangeChange} />
                    </div>
                    <button className="reset-filters" onClick={resetFilters}>Reset Filters</button>
                  </div>
                </div>
  
                <div className="transactions-list">
                  {filteredTransactions.length === 0 ? (
                    <div className="no-transactions">No transactions found.</div>
                  ) : (
                    filteredTransactions.map(transaction => (
                      <div key={transaction.id} className={`transaction ${transaction.type}`}>
                        <div className="transaction-icon">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="12" fill={transaction.type === "income" ? "var(--income)" : "var(--expense)"} />
                            {transaction.type === "income" ? (
                              <path d="M7 13L12 8L17 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            ) : (
                              <path d="M7 11L12 16L17 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            )}
                          </svg>
                        </div>
                        <div className="transaction-details">
                          <div className="transaction-description">{transaction.description}</div>
                          {transaction.party && <div className="transaction-party"><em>{transaction.type === "income" ? "From: " : "To: "}</em>{transaction.party}</div>}
                          <div className="transaction-tags">
                            {transaction.tags && transaction.tags.map((tag, index) => (
                              <span key={index} className={`tag ${filterTag === tag ? "filter-active" : ""}`} onClick={() => handleFilterTagChange(tag)}>{tag}</span>
                            ))}
                          </div>
                          <div className="transaction-date">{formatDate(transaction.date || transaction.createdAt)}</div>
                        </div>
                        <div className="transaction-amount">
                          <span>{transaction.type === "income" ? "+" : "-"}{CURRENCY.symbol}{formatAmount(transaction.amount)}</span>
                        </div>
                        <div className="transaction-actions">
                          <button className="edit-btn" onClick={() => editTransaction(transaction)}>✏️</button>
                          <button className="delete-btn" onClick={() => deleteTransaction(transaction.id)}>🗑️</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
  
        {/* Monthly Overview View */}
        {activeView === "overview" && (
          <MonthlyOverviewDiagram transactions={transactions} currentMonthDate={currentMonth} />
        )}
  
        {/* Bucket List View */}
        {activeView === "bucketlist" && (
          <div className="bucket-list-section card-style">
            <h2>My Bucket List</h2>
            <div className="add-bucket-item-form">
              <input
                type="text"
                value={newBucketItemText}
                onChange={(e) => setNewBucketItemText(e.target.value)}
                placeholder="New bucket list item..."
              />
              <textarea
                value={newBucketItemNotes}
                onChange={(e) => setNewBucketItemNotes(e.target.value)}
                placeholder="Notes (optional)..."
              />
              <button onClick={handleAddBucketItem} className="add-btn">Add Item</button>
            </div>
            <div className="bucket-items-display">
              {bucketListItems.length === 0 ? (
                <p>Your bucket list is empty. Add something you aspire to!</p>
              ) : (
                bucketListItems.map(item => (
                  <BucketListItem
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateBucketItem}
                    onDelete={handleDeleteBucketItem}
                    onToggleComplete={handleToggleBucketItemComplete}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;