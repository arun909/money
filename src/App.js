import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc,
  where,
  query,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

const CURRENCY = {
  symbol: "₹",
  code: "INR"
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [transactionType, setTransactionType] = useState("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
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
  


  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(true);
  
  // New state 
  // for budget features
  const [budgets, setBudgets] = useState([]);
  const [newBudget, setNewBudget] = useState({
    category: "",
    amount: "",
    period: "monthly"
  });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  
  // Mobile navigation
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const transactionsUnsub = onSnapshot(
          collection(db, "transactions"), 
          (snapshot) => {
            const transactionsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            setTransactions(transactionsData);
            calculateBalance(transactionsData);
            calculateStatistics(transactionsData);
          }
        );

        const tagsUnsub = onSnapshot(
          collection(db, "tags"), 
          (snapshot) => {
            const tagsData = snapshot.docs.map(doc => doc.data().name);
            setTags(tagsData);
          }
        );
        
        // Fetch budgets
        const budgetsUnsub = onSnapshot(
          collection(db, "budgets"),
          (snapshot) => {
            const budgetsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setBudgets(budgetsData);
          }
        );

        setLoading(false);

        return () => {
          transactionsUnsub();
          tagsUnsub();
          budgetsUnsub();
        };
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  
  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const calculateStatistics = (transactions) => {
    // Calculate total income and expense
    const totalIncome = transactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
    const totalExpense = transactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
    // Calculate top expense categories (by tags)
    const expensesByTag = {};
    transactions
      .filter(t => t.type === "expense")
      .forEach(transaction => {
        if (transaction.tags && transaction.tags.length > 0) {
          transaction.tags.forEach(tag => {
            if (!expensesByTag[tag]) {
              expensesByTag[tag] = 0;
            }
            expensesByTag[tag] += Number(transaction.amount || 0);
          });
        } else {
          if (!expensesByTag["Uncategorized"]) {
            expensesByTag["Uncategorized"] = 0;
          }
          expensesByTag["Uncategorized"] += Number(transaction.amount || 0);
        }
      });
    
    // Convert to array and sort
    const topExpenseCategories = Object.entries(expensesByTag)
      .map(([tag, amount]) => ({ tag, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    setStatistics({
      totalIncome,
      totalExpense,
      topExpenseCategories
    });
  };

  const calculateBalance = (transactions) => {
    const total = transactions.reduce((acc, transaction) => {
      return transaction.type === "income" 
        ? acc + Number(transaction.amount || 0)
        : acc - Number(transaction.amount || 0);
    }, 0);
    setBalance(total);
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleTagChange = (e) => {
    setNewTag(e.target.value);
  };

  const addTag = async () => {
    if (newTag.trim()) {
      try {
        await addDoc(collection(db, "tags"), {
          name: newTag.trim()
        });
        setNewTag("");
      } catch (error) {
        console.error("Error adding tag:", error);
      }
    }
  };

  const removeTag = async (tag) => {
    try {
      const q = query(collection(db, "tags"), where("name", "==", tag));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  const handleTransactionTypeChange = (type) => {
    setTransactionType(type);
  };

  const handleSubmitTransaction = async () => {
    if (amount && !isNaN(amount) && description.trim()) {
      try {
        if (editingTransaction) {
          // Update existing transaction
          await updateDoc(doc(db, "transactions", editingTransaction.id), {
            type: transactionType,
            amount: Number(amount),
            description: description.trim(),
            tags: selectedTags,
            updatedAt: new Date()
          });
          setEditingTransaction(null);
        } else {
          // Add new transaction
          await addDoc(collection(db, "transactions"), {
            type: transactionType,
            amount: Number(amount),
            description: description.trim(),
            tags: selectedTags,
            date: selectedDate.toISOString(),
            createdAt: new Date()
          });
        }
        // Reset form
        setAmount("");
        setDescription("");
        setSelectedTags([]);
        setTransactionType("income");
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
    
    // Scroll to form
    document.querySelector('.transaction-form-container').scrollIntoView({ 
      behavior: 'smooth' 
    });
  };

  const deleteTransaction = async (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteDoc(doc(db, "transactions", id));
      } catch (error) {
        console.error("Error deleting transaction:", error);
      }
    }
  };

  const handleTagSelect = (tag) => {
    setSelectedTags((prevTags) =>
      prevTags.includes(tag)
        ? prevTags.filter((t) => t !== tag)
        : [...prevTags, tag]
    );
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
  };

  const handleFilterTagChange = (tag) => {
    setFilterTag(tag === filterTag ? "" : tag);
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetFilters = () => {
    setFilterType("all");
    setFilterTag("");
    setDateRange({ start: "", end: "" });
  };

  // Calendar functions
  const toggleCalendarVisibility = () => {
    setCalendarVisible(prev => !prev);
  };

  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  const changeMonth = (offset) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newMonth);
  };

  const renderCalendar = () => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Get transactions for this month to mark on calendar
    const transactionsThisMonth = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === month && tDate.getFullYear() === year;
    });
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selectedDate.getDate() === day && 
                        selectedDate.getMonth() === month && 
                        selectedDate.getFullYear() === year;
      
      // Check if day has transactions
      const dateStr = new Date(year, month, day).toISOString().split('T')[0];
      const hasTransactions = transactionsThisMonth.some(t => 
        t.date.split('T')[0] === dateStr
      );
      
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
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>
        <div className="calendar-days">
          {days}
        </div>
      </div>
    );
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatAmount = (amount) => {
    const num = Number(amount);
    return !isNaN(num) ? num.toFixed(2) : "0.00";
  };
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  // Filter transactions based on current filters
  const filteredTransactions = transactions.filter(transaction => {
    // Filter by type
    if (filterType !== "all" && transaction.type !== filterType) {
      return false;
    }
    
    // Filter by tag
    if (filterTag && (!transaction.tags || !transaction.tags.includes(filterTag))) {
      return false;
    }
    
    // Filter by date range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      const transactionDate = new Date(transaction.date);
      if (transactionDate < startDate) {
        return false;
      }
    }
    
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); // End of day
      const transactionDate = new Date(transaction.date);
      if (transactionDate > endDate) {
        return false;
      }
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

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>My-Money</h1>
        </div>
        <div className="navbar-actions">
          <button className="theme-toggle" onClick={toggleTheme}>
            {isDarkMode ? "🌞" : "🌙"}
          </button>
          
        </div>
      </nav>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="balance-card">
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

        <div className="tags-section">
          <div className="tags-header">
            <h3>Tags</h3>
          </div>
          <div className="tag-input">
            <input
              type="text"
              value={newTag}
              onChange={handleTagChange}
              placeholder="Add new tag"
            />
            <button onClick={addTag}>Add</button>
          </div>
          <div className="tag-list">
            {tags.map((tag, index) => (
              <div key={index} className="tag-container">
                <span
                  className={`tag ${selectedTags.includes(tag) ? "active" : ""} ${filterTag === tag ? "active" : ""}`}
                  onClick={() => handleTagSelect(tag)}
                >
                  {tag}
                </span>
                <button
                  className="delete-tag"
                  onClick={() => removeTag(tag)}
                  title="Remove tag"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="main-content">
        {/* Calendar */}
        <div className="calendar-container">
          <div className="calendar-toggle" onClick={toggleCalendarVisibility}>
            <h2>Calendar {calendarVisible ? "▼" : "▶"}</h2>
            <span>{selectedDate.toDateString()}</span>
          </div>
          {calendarVisible && renderCalendar()}
        </div>

        {/* Transaction Form */}
        <div className="transaction-form-container">
          <div className="transaction-form">
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
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                className="description-input"
              ></textarea>
            </div>

            {selectedTags.length > 0 && (
              <div className="selected-tags">
                <label>Selected Tags:</label>
                <div className="tags-list">
                  {selectedTags.map((tag, index) => (
                    <span 
                      key={index} 
                      className="tag active"
                      onClick={() => handleTagSelect(tag)}
                    >
                      {tag} ✕
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button className="submit-btn" onClick={handleSubmitTransaction}>
              {editingTransaction 
                ? "Update Transaction" 
                : transactionType === "income" ? "Add Income" : "Add Expense"}
            </button>
            
            {editingTransaction && (
              <button 
                className="cancel-btn" 
                onClick={() => {
                  setEditingTransaction(null);
                  setAmount("");
                  setDescription("");
                  setSelectedTags([]);
                  setTransactionType("income");
                }}
              >
                Cancel Editing
              </button>
            )}
          </div>
        </div>

        {/* Transactions List */}
        <div className="transactions-container">
          <div className="transactions-header">
            <h2>Transactions</h2>
            <div className="filters">
              <div className="filter-group">
                <span>Type:</span>
                <button 
                  className={`filter-btn ${filterType === "all" ? "active" : ""}`}
                  onClick={() => handleFilterChange("all")}
                >
                  All
                </button>
                <button 
                  className={`filter-btn ${filterType === "income" ? "active income" : ""}`}
                  onClick={() => handleFilterChange("income")}
                >
                  Income
                </button>
                <button 
                  className={`filter-btn ${filterType === "expense" ? "active expense" : ""}`}
                  onClick={() => handleFilterChange("expense")}
                >
                  Expense
                </button>
              </div>
              
              <div className="filter-group">
                <span>Date:</span>
                <input 
                  type="date"
                  name="start"
                  value={dateRange.start}
                  onChange={handleDateRangeChange}
                  placeholder="Start date"
                />
                <input 
                  type="date"
                  name="end"
                  value={dateRange.end}
                  onChange={handleDateRangeChange}
                  placeholder="End date"
                />
              </div>
              
              <button className="reset-filters" onClick={resetFilters}>
                Reset Filters
              </button>
            </div>
          </div>
          
          <div className="transactions-list">
            {filteredTransactions.length === 0 ? (
              <div className="no-transactions">No transactions found with the current filters.</div>
            ) : (
              [...filteredTransactions]
                .sort((a, b) => {
                  // Sort by date (newest first)
                  const dateA = new Date(a.date || a.createdAt);
                  const dateB = new Date(b.date || b.createdAt);
                  return dateB - dateA;
                })
                .map((transaction) => (
                <div key={transaction.id} className={`transaction ${transaction.type}`}>
                  <div className="transaction-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                    <div className="transaction-tags">
                      {transaction.tags && transaction.tags.map((tag, index) => (
                        <span 
                          key={index} 
                          className="tag"
                          onClick={() => handleFilterTagChange(tag)}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="transaction-date">{formatDate(transaction.date || transaction.createdAt)}</div>
                  </div>
                  <div className="transaction-amount">
                    <span>
                      {transaction.type === "income" ? "+" : "-"}{CURRENCY.symbol}{formatAmount(transaction.amount)}
                    </span>
                  </div>
                  <div className="transaction-actions">
                    <button 
                      className="edit-btn" 
                      onClick={() => editTransaction(transaction)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button 
                      className="delete-btn" 
                      onClick={() => deleteTransaction(transaction.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;