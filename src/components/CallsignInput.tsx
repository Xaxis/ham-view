import React, { useState, useRef, useCallback, useEffect } from 'react';

interface CallsignInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CallsignInput({ value, onChange, placeholder = "Enter callsign (e.g., W1AW, JA1XYZ)..." }: CallsignInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isActive, setIsActive] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only sync from parent when not actively editing
  useEffect(() => {
    if (!isActive && value !== localValue) {
      setLocalValue(value);
    }
  }, [value, isActive, localValue]);

  // Debounced onChange
  const debouncedOnChange = useCallback((newValue: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      onChange(newValue);
      setIsActive(false);
    }, 500);
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setLocalValue(newValue);
    setIsActive(true);
    debouncedOnChange(newValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      onChange(localValue);
      setIsActive(false);
    }
  };

  const handleFocus = () => {
    setIsActive(true);
  };

  const handleBlur = () => {
    // Small delay to allow for any pending operations
    setTimeout(() => {
      setIsActive(false);
    }, 100);
  };

  const handleSearch = () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    onChange(localValue);
    setIsActive(false);
  };

  const handleClear = () => {
    setLocalValue('');
    setIsActive(false);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="callsign-input-group">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="callsign-input"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        className="callsign-search-btn"
        onClick={handleSearch}
        title="Search"
        type="button"
      >
        🔍
      </button>
      {localValue && (
        <button
          className="callsign-clear-btn"
          onClick={handleClear}
          title="Clear search"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}
