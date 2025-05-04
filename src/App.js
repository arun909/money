import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc,
  where,
  query,
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
          }
        );

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
        await addDoc(collection(db, "transactions"), {
          type: transactionType,
          amount: Number(amount),
          description: description.trim(),
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

  const formatAmount = (amount) => {
    const num = Number(amount);
    return !isNaN(num) ? num.toFixed(2) : "0.00";
  };

  if (loading) {
    return <div className="loading">Loading My-Money...</div>;
  }

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <h1><span>🥭</span> My-Money</h1>
          <button className="theme-toggle" onClick={toggleTheme}>
            {isDarkMode ? "🌞" : "🌙"}
          </button>
        </div>

        <div className="balance-card">
          <h3>Total Balance</h3>
          <div className="balance-amount">
            <span>${balance.toFixed(2)}</span>
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
              placeholder="New tag"
            />
            <button onClick={addTag}>Add</button>
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

      <div className="main-content">
        <div className="transaction-form-container">
          <div className="transaction-form">
            <h2>Create Transaction</h2>

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

            <button className="submit-btn" onClick={handleSubmitTransaction}>
              {transactionType === "income" ? "Add Income" : "Add Expense"}
            </button>
          </div>
        </div>

        <div className="transactions-container">
          <h2>Recent Transactions</h2>
          <div className="transactions-list">
            {transactions.length === 0 ? (
              <div className="no-transactions">No transactions yet. Start by adding one!</div>
            ) : (
              [...transactions]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="transaction-date">{formatDate(transaction.date)}</div>
                  </div>
                  <div className="transaction-amount">
                    <span>
                      {transaction.type === "income" ? "+" : "-"}${formatAmount(transaction.amount)}
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
