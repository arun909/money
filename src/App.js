import React, { useState, useEffect } from "react";
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

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleTagChange = (e) => {
    setNewTag(e.target.value);
  };

  const addTag = () => {
    if (newTag.trim()) {
      setTags((prevTags) => [...prevTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag) => {
    setTags((prevTags) => prevTags.filter((t) => t !== tag));
  };
a
  const handleTransactionTypeChange = (type) => {
    setTransactionType(type);
  };

  const handleSubmitTransaction = () => {
    if (amount && description) {
      setTransactions((prevTransactions) => [
        ...prevTransactions,
        {
          type: transactionType,
          amount,
          description,
          tags: selectedTags,
          date: new Date().toLocaleString(),
        },
      ]);
      setAmount("");
      setDescription("");
      setSelectedTags([]);
    }
  };

  const handleTagSelect = (tag) => {
    setSelectedTags((prevTags) =>
      prevTags.includes(tag)
        ? prevTags.filter((t) => t !== tag)
        : [...prevTags, tag]
    );
  };

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
            <span>$0.00</span>
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
              transactions.map((transaction, index) => (
                <div key={index} className={`transaction ${transaction.type}`}>
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
                      {transaction.tags.map((tag, index) => (
                        <span key={index} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="transaction-date">{transaction.date}</div>
                  </div>
                  <div className="transaction-amount">
                    <span>
                      {transaction.type === "income" ? "+" : "-"}${transaction.amount}
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
