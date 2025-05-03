import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [transactionType, setTransactionType] = useState("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Initialize Firebase listeners
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Set up real-time listener for transactions
        const transactionsUnsub = onSnapshot(
          collection(db, "transactions"), 
          (snapshot) => {
            const transactionsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setTransactions(transactionsData);
            calculateBalance(transactionsData);
          }
        );

        // Set up real-time listener for tags
        const tagsUnsub = onSnapshot(
          collection(db, "tags"), 
          (snapshot) => {
            const tagsData = snapshot.docs.map(doc => doc.data().name);
            setTags(tagsData);
          }
        );

        setLoading(false);

        return () => {
          transactionsUnsub();
          tagsUnsub();
        };
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateBalance = (transactions) => {
    const total = transactions.reduce((acc, transaction) => {
      return transaction.type === "income" 
        ? acc + Number(transaction.amount)
        : acc - Number(transaction.amount);
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
      // Note: This implementation assumes you have document IDs for tags
      // You might need to adjust based on your actual Firestore structure
      const querySnapshot = await getDocs(
        collection(db, "tags"),
        where("name", "==", tag)
      );
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
    if (amount && description) {
      try {
        await addDoc(collection(db, "transactions"), {
          type: transactionType,
          amount: Number(amount),
          description,
          tags: selectedTags,
          date: new Date().toISOString(),
          createdAt: new Date()
        });
        setAmount("");
        setDescription("");
        setSelectedTags([]);
      } catch (error) {
        console.error("Error adding transaction:", error);
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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>
            <span>💰</span> Money Tracker
          </h1>
          <button className="theme-toggle" onClick={toggleTheme}>
            {isDarkMode ? "🌞" : "🌙"}
          </button>
        </div>

        {/* Balance Card */}
        <div className="balance-card">
          <h3>Total Balance</h3>
          <div className="balance-amount">
            <span>${balance.toFixed(2)}</span>
          </div>
        </div>

        {/* Tags Section */}
        <div className="tags-section">
          <div className="tags-header">
            <h3>Tags</h3>
            <button onClick={addTag}>Add</button>
          </div>
          <div className="tag-input">
            <input
              type="text"
              value={newTag}
              onChange={handleTagChange}
              placeholder="New tag"
            />
            <button onClick={addTag}>Add Tag</button>
          </div>
          <div className="tag-list">
            {tags.map((tag, index) => (
              <div key={index} className="tag-container">
                <span
                  className={`tag ${selectedTags.includes(tag) ? "active" : ""}`}
                  onClick={() => handleTagSelect(tag)}
                >
                  {tag}
                </span>
                <button
                  className="delete-tag"
                  onClick={() => removeTag(tag)}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="transaction-form-container">
          <div className="transaction-form">
            <h2>Create Transaction</h2>

            {/* Transaction Type Toggle */}
            <div className="type-toggle">
              <button
                className={`toggle-btn ${transactionType === "income" ? "active income" : ""}`}
                onClick={() => handleTransactionTypeChange("income")}
              >
                Income
              </button>
              <button
                className={`toggle-btn ${transactionType === "expense" ? "active expense" : ""}`}
                onClick={() => handleTransactionTypeChange("expense")}
              >
                Expense
              </button>
            </div>

            {/* Amount & Description */}
            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="selected-tags">
                <label>Selected Tags:</label>
                <div className="tags-list">
                  {selectedTags.map((tag, index) => (
                    <span key={index} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button className="submit-btn" onClick={handleSubmitTransaction}>
              Submit
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className="transactions-container">
          <h2>Transactions</h2>
          <div className="transactions-list">
            {transactions.length === 0 ? (
              <div className="no-transactions">No transactions yet</div>
            ) : (
              [...transactions]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((transaction) => (
                <div key={transaction.id} className={`transaction ${transaction.type}`}>
                  <div className="transaction-icon">
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="12" fill={transaction.type === "income" ? "#10b981" : "#ef4444"} />
                    </svg>
                  </div>
                  <div className="transaction-details">
                    <div className="transaction-description">{transaction.description}</div>
                    <div className="transaction-tags">
                      {transaction.tags && transaction.tags.map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="transaction-date">{formatDate(transaction.date)}</div>
                  </div>
                  <div className="transaction-amount">
                    <span>
                      {transaction.type === "income" ? "+" : "-"}${transaction.amount.toFixed(2)}
                    </span>
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