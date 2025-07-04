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
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { Chart, registerables } from 'chart.js/auto';
import "./App.css";
import { Settings, Calendar, TrendingUp, Target, CreditCard, Plus, Filter, X } from "lucide-react";

Chart.register(...registerables);

const CURRENCY = {
  symbol: "₹",
  code: "INR"
};

// Weekly Overview Component
const WeeklyOverviewDiagram = ({ transactions, selectedWeek }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Calculate start and end of the selected week
    const startOfWeek = new Date(selectedWeek);
    startOfWeek.setDate(selectedWeek.getDate() - selectedWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Filter transactions for the week
    const weeklyTransactions = transactions.filter(t => {
      const tDate = new Date(t.date || (t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt));
      return tDate >= startOfWeek && tDate <= endOfWeek;
    });

    // Group by day of week
    const dailyData = Array(7).fill(0).map((_, index) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + index);
      
      const dayTransactions = weeklyTransactions.filter(t => {
        const tDate = new Date(t.date || (t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt));
        return tDate.toDateString() === day.toDateString();
      });

      const income = dayTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      const expense = dayTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      return { day: day.toLocaleDateString('en', { weekday: 'short' }), income, expense };
    });

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: dailyData.map(d => d.day),
        datasets: [
          {
            label: "Income",
            data: dailyData.map(d => d.income),
            borderColor: "rgb(16, 185, 129)",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            tension: 0.4,
            fill: true
          },
          {
            label: "Expense",
            data: dailyData.map(d => d.expense),
            borderColor: "rgb(239, 68, 68)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: `Week of ${startOfWeek.toLocaleDateString()}`
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return CURRENCY.symbol + value;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [transactions, selectedWeek]);

  return (
    <div className="weekly-overview-container card-style">
      <div className="overview-header">
        <TrendingUp className="overview-icon" />
        <h2>Weekly Financial Overview</h2>
      </div>
      <div className="chart-container">
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

// Monthly Overview Component (Enhanced)
const MonthlyOverviewDiagram = ({ transactions, currentMonthDate }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
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
      type: "doughnut",
      data: {
        labels: ["Income", "Expense", "Savings"],
        datasets: [
          {
            data: [monthlyIncome, monthlyExpense, Math.max(0, monthlyIncome - monthlyExpense)],
            backgroundColor: [
              "rgba(16, 185, 129, 0.8)",
              "rgba(239, 68, 68, 0.8)",
              "rgba(59, 130, 246, 0.8)"
            ],
            borderColor: [
              "rgb(16, 185, 129)",
              "rgb(239, 68, 68)",
              "rgb(59, 130, 246)"
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: true,
            text: `${currentMonthDate.toLocaleString('default', { month: 'long' })} ${year} Overview`
          }
        }
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
      <div className="overview-header">
        <Calendar className="overview-icon" />
        <h2>Monthly Financial Overview</h2>
      </div>
      <div className="chart-container">
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

// Bucket List Item Component (Enhanced)
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
            className="edit-input"
          />
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="edit-textarea"
          />
          <div className="actions">
            <button onClick={handleSave} className="save-btn">
              <Plus className="btn-icon" /> Save
            </button>
            <button onClick={() => setIsEditing(false)} className="cancel-btn">
              <X className="btn-icon" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bucket-item-view">
          <div className="item-content" onClick={() => onToggleComplete(item.id, !item.isCompleted)}>
            <input 
              type="checkbox" 
              checked={item.isCompleted} 
              onChange={() => {}} 
              className="item-checkbox"
            />
            <span className="item-text">{item.text}</span>
          </div>
          {item.notes && (
            <div className="item-notes">
              <span className="notes-label">Notes:</span> {item.notes}
            </div>
          )}
          <div className="actions">
            <button onClick={() => setIsEditing(true)} className="edit-btn">
              ✏️
            </button>
            <button onClick={() => onDelete(item.id)} className="delete-btn">
              🗑️
            </button>
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
  const [transactionParty, setTransactionParty] = useState("");
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
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");
  const [bucketListItems, setBucketListItems] = useState([]);
  const [newBucketItemText, setNewBucketItemText] = useState("");
  const [newBucketItemNotes, setNewBucketItemNotes] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest");

  useEffect(() => {
    setLoading(true);
    
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
    });

    const tagsUnsub = onSnapshot(collection(db, "tags"), (snapshot) => {
      const tagsData = snapshot.docs.map(doc => doc.data().name);
      setTags(tagsData);
    }, (error) => {
      console.error("Error fetching tags:", error);
    });

    const bucketListQuery = query(collection(db, "bucketListItems"), orderBy("createdAt", "desc"));
    const bucketListUnsub = onSnapshot(bucketListQuery, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBucketListItems(itemsData);
    }, (error) => {
      console.error("Error fetching bucket list items:", error);
    });

    Promise.all([getDocs(transactionsQuery)]).then(() => {
      setLoading(false);
    }).catch(() => {
      setLoading(false);
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
    
    const topExpenseCategories = Object.entries(expensesByTag)
      .map(([tag, amount]) => ({ tag, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    setStatistics({ totalIncome, totalExpense, topExpenseCategories });
  };

  const calculateBalance = (transactionsData) => {
    const total = transactionsData.reduce((acc, transaction) => 
      transaction.type === "income" ? acc + Number(transaction.amount || 0) : acc - Number(transaction.amount || 0), 0);
    setBalance(total);
  };

  const toggleTheme = () => setIsDarkMode(prev => !prev);

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
    setSelectedDate(new Date(transaction.date || (transaction.createdAt?.toDate ? transaction.createdAt.toDate() : transaction.createdAt)));
    setActiveView("dashboard");
    
    setTimeout(() => {
      const formContainer = document.querySelector('.transaction-form-container');
      if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
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
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleFilterChange = (type) => setFilterType(type);
  const handleFilterTagChange = (tag) => setFilterTag(prev => prev === tag ? "" : tag);

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
    setSortOrder("newest");
  };

  const toggleCalendarVisibility = () => setCalendarVisible(prev => !prev);
  
  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };
  
  const changeMonth = (offset) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const changeWeek = (offset) => {
    setSelectedWeek(prev => {
      const newWeek = new Date(prev);
      newWeek.setDate(prev.getDate() + (offset * 7));
      return newWeek;
    });
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
          <button onClick={() => changeMonth(-1)} className="nav-btn">←</button>
          <h3>{monthNames[month]} {year}</h3>
          <button onClick={() => changeMonth(1)} className="nav-btn">→</button>
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

  const sortTransactions = (transactionsToSort) => {
    return [...transactionsToSort].sort((a, b) => {
      const dateA = new Date(a.date || (a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt));
      const dateB = new Date(b.date || (b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt));
      
      switch (sortOrder) {
        case "newest":
          return dateB - dateA;
        case "oldest":
          return dateA - dateB;
        case "highest":
          return Number(b.amount) - Number(a.amount);
        case "lowest":
          return Number(a.amount) - Number(b.amount);
        default:
          return dateB - dateA;
      }
    });
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filterType !== "all" && transaction.type !== filterType) return false;
    if (filterTag && (!transaction.tags || !transaction.tags.includes(filterTag))) return false;
    
    const transactionDateRaw = transaction.date || transaction.createdAt;
    if (!transactionDateRaw) return true;
    
    const transactionDate = transactionDateRaw.toDate ? transactionDateRaw.toDate() : new Date(transactionDateRaw);

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
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

  const sortedTransactions = sortTransactions(filteredTransactions);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        Loading EXPANSIO...
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">💰</span>
          EXPANSIO
        </div>

        <div className="navbar-controls">
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
          
          <div className="navbar-settings">
            <button className="gear-button" onClick={() => setShowMenu(!showMenu)}>
              <Settings size={20} />
            </button>

            {showMenu && (
              <div className="dropdown-menu">
                <button onClick={() => { setActiveView("dashboard"); setShowMenu(false); }}>
                  <CreditCard size={16} /> Dashboard
                </button>
                <button onClick={() => { setActiveView("weekly"); setShowMenu(false); }}>
                  <TrendingUp size={16} /> Weekly Overview
                </button>
                <button onClick={() => { setActiveView("monthly"); setShowMenu(false); }}>
                  <Calendar size={16} /> Monthly Overview
                </button>
                <button onClick={() => { setActiveView("bucketlist"); setShowMenu(false); }}>
                  <Target size={16} /> Bucket List
                </button>
                <button onClick={() => { setActiveView("transactions"); setShowMenu(false); }}>
                  <CreditCard size={16} /> Transactions
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="app-container">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="balance-card card-style">
            <div className="balance-header">
              <h3>Total Balance</h3>
              <div className={`balance-indicator ${balance >= 0 ? 'positive' : 'negative'}`}>
                {balance >= 0 ? '📈' : '📉'}
              </div>
            </div>
            <div className="balance-amount">
              <span className={balance >= 0 ? 'positive' : 'negative'}>
                {CURRENCY.symbol}{formatAmount(Math.abs(balance))}
              </span>
              <small>{balance >= 0 ? 'Available' : 'Deficit'}</small>
            </div>
            <div className="balance-summary">
              <div className="income-summary">
                <div className="summary-icon">💰</div>
                <div className="summary-details">
                  <span className="summary-label">Income</span>
                  <span className="summary-amount">{CURRENCY.symbol}{formatAmount(statistics.totalIncome)}</span>
                </div>
              </div>
              <div className="expense-summary">
                <div className="summary-icon">💸</div>
                <div className="summary-details">
                  <span className="summary-label">Expense</span>
                  <span className="summary-amount">{CURRENCY.symbol}{formatAmount(statistics.totalExpense)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats card-style">
            <h4>Quick Stats</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Transactions</span>
                <span className="stat-value">{transactions.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">This Month</span>
                <span className="stat-value">
                  {transactions.filter(t => {
                    const tDate = new Date(t.date || (t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt));
                    const now = new Date();
                    return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
                  }).length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Dashboard View */}
          {activeView === "dashboard" && (
            <div className="dashboard-grid">
              <div className="calendar-section">
                <div className="calendar-container card-style">
                  <div className="calendar-toggle" onClick={toggleCalendarVisibility}>
                    <div className="toggle-content">
                      <Calendar size={20} />
                      <h3>Calendar</h3>
                    </div>
                    <div className="toggle-info">
                      <span>{selectedDate.toDateString()}</span>
                      <span className="toggle-icon">{calendarVisible ? "▼" : "▶"}</span>
                    </div>
                  </div>
                  {calendarVisible && renderCalendar()}
                </div>
              </div>

              <div className="form-section">
                <div className="transaction-form-container card-style">
                  <div className="form-header">
                    <h3>{editingTransaction ? "Edit Transaction" : "New Transaction"}</h3>
                    {editingTransaction && (
                      <button 
                        className="close-edit-btn"
                        onClick={() => {
                          setEditingTransaction(null);
                          setAmount("");
                          setDescription("");
                          setTransactionParty("");
                          setSelectedTags([]);
                          setTransactionType("income");
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div className="type-toggle">
                    <button
                      className={`toggle-btn ${transactionType === "income" ? "active income" : ""}`}
                      onClick={() => setTransactionType("income")}
                    >
                      <span className="toggle-icon">💰</span>
                      Income
                    </button>
                    <button
                      className={`toggle-btn ${transactionType === "expense" ? "active expense" : ""}`}
                      onClick={() => setTransactionType("expense")}
                    >
                      <span className="toggle-icon">💸</span>
                      Expense
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Amount ({CURRENCY.symbol})</label>
                      <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        placeholder="0.00"
                        className="amount-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        placeholder="What was this for?"
                        className="description-input"
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label>{transactionType === "income" ? "Received From" : "Paid To"}</label>
                      <input 
                        type="text" 
                        value={transactionParty} 
                        onChange={(e) => setTransactionParty(e.target.value)} 
                        placeholder={transactionType === "income" ? "Source of income" : "Where you spent"}
                      />
                    </div>
                  </div>

                  <button className="submit-btn" onClick={handleSubmitTransaction}>
                    <Plus size={16} />
                    {editingTransaction ? "Update Transaction" : `Add ${transactionType === "income" ? "Income" : "Expense"}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Overview View */}
          {activeView === "weekly" && (
            <div className="overview-container">
              <div className="overview-controls">
                <button onClick={() => changeWeek(-1)} className="nav-btn">← Previous Week</button>
                <h2>Week of {selectedWeek.toLocaleDateString()}</h2>
                <button onClick={() => changeWeek(1)} className="nav-btn">Next Week →</button>
              </div>
              <WeeklyOverviewDiagram transactions={transactions} selectedWeek={selectedWeek} />
            </div>
          )}

          {/* Monthly Overview View */}
          {activeView === "monthly" && (
            <div className="overview-container">
              <div className="overview-controls">
                <button onClick={() => changeMonth(-1)} className="nav-btn">← Previous Month</button>
                <h2>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => changeMonth(1)} className="nav-btn">Next Month →</button>
              </div>
              <MonthlyOverviewDiagram transactions={transactions} currentMonthDate={currentMonth} />
            </div>
          )}

          {/* Transactions View */}
          {activeView === "transactions" && (
            <div className="transactions-section">
              <div className="transactions-container card-style">
                <div className="transactions-header">
                  <div className="header-content">
                    <h3>All Transactions</h3>
                    <button 
                      className="filter-toggle-btn"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter size={16} />
                      Filters & Sort
                    </button>
                  </div>

                  {showFilters && (
                    <div className="filters-panel">
                      <div className="filters-grid">
                        <div className="filter-group">
                          <label>Type</label>
                          <div className="filter-buttons">
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
                        </div>

                        <div className="filter-group">
                          <label>Date Range</label>
                          <div className="date-inputs">
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
                        </div>

                        <div className="filter-group">
                          <label>Sort By</label>
                          <select 
                            value={sortOrder} 
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="sort-select"
                          >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="highest">Highest Amount</option>
                            <option value="lowest">Lowest Amount</option>
                          </select>
                        </div>

                        <div className="filter-actions">
                          <button className="reset-filters-btn" onClick={resetFilters}>
                            <X size={14} />
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="transactions-list">
                  {sortedTransactions.length === 0 ? (
                    <div className="no-transactions">
                      <div className="empty-state">
                        <span className="empty-icon">📝</span>
                        <h4>No transactions found</h4>
                        <p>Try adjusting your filters or add a new transaction</p>
                      </div>
                    </div>
                  ) : (
                    sortedTransactions.map(transaction => (
                      <div key={transaction.id} className={`transaction ${transaction.type}`}>
                        <div className="transaction-icon">
                          <div className={`icon-circle ${transaction.type}`}>
                            {transaction.type === "income" ? "↗" : "↙"}
                          </div>
                        </div>
                        
                        <div className="transaction-details">
                          <div className="transaction-main">
                            <h4 className="transaction-description">{transaction.description}</h4>
                            <div className="transaction-amount">
                              <span className={transaction.type}>
                                {transaction.type === "income" ? "+" : "-"}{CURRENCY.symbol}{formatAmount(transaction.amount)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="transaction-meta">
                            {transaction.party && (
                              <span className="transaction-party">
                                {transaction.type === "income" ? "From: " : "To: "}{transaction.party}
                              </span>
                            )}
                            <span className="transaction-date">{formatDate(transaction.date || transaction.createdAt)}</span>
                          </div>

                          {transaction.tags && transaction.tags.length > 0 && (
                            <div className="transaction-tags">
                              {transaction.tags.map((tag, index) => (
                                <span 
                                  key={index} 
                                  className={`tag ${filterTag === tag ? "filter-active" : ""}`} 
                                  onClick={() => handleFilterTagChange(tag)}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="transaction-actions">
                          <button className="edit-btn" onClick={() => editTransaction(transaction)}>
                            ✏️
                          </button>
                          <button className="delete-btn" onClick={() => deleteTransaction(transaction.id)}>
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bucket List View */}
          {activeView === "bucketlist" && (
            <div className="bucket-list-section card-style">
              <div className="section-header">
                <Target className="section-icon" />
                <h2>My Bucket List</h2>
              </div>
              
              <div className="add-bucket-item-form">
                <div className="form-grid">
                  <input
                    type="text"
                    value={newBucketItemText}
                    onChange={(e) => setNewBucketItemText(e.target.value)}
                    placeholder="What do you want to achieve?"
                    className="bucket-input"
                  />
                  <textarea
                    value={newBucketItemNotes}
                    onChange={(e) => setNewBucketItemNotes(e.target.value)}
                    placeholder="Add some notes about this goal..."
                    className="bucket-textarea"
                    rows="2"
                  />
                </div>
                <button onClick={handleAddBucketItem} className="add-btn">
                  <Plus size={16} />
                  Add to Bucket List
                </button>
              </div>

              <div className="bucket-items-display">
                {bucketListItems.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">🎯</span>
                    <h4>Your bucket list is empty</h4>
                    <p>Add something you aspire to achieve!</p>
                  </div>
                ) : (
                  <div className="bucket-items-grid">
                    {bucketListItems.map(item => (
                      <BucketListItem
                        key={item.id}
                        item={item}
                        onUpdate={handleUpdateBucketItem}
                        onDelete={handleDeleteBucketItem}
                        onToggleComplete={handleToggleBucketItemComplete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;