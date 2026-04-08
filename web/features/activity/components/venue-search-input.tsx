import React, { useDeferredValue, useEffect, useState } from 'react';
import type { VenueSearchItem } from '../api/venue-api';
import { searchVenues } from '../api/venue-api';

interface VenueSearchInputProps {
  selectedVenue: VenueSearchItem | null;
  onChangeSelection: (venue: VenueSearchItem | null) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
}

export function VenueSearchInput({
  selectedVenue,
  onChangeSelection,
  placeholder = '搜索球馆',
  error,
  helperText,
}: VenueSearchInputProps) {
  const [searchValue, setSearchValue] = useState(selectedVenue?.name ?? '');
  const [items, setItems] = useState<VenueSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const deferredSearchValue = useDeferredValue(searchValue);
  const selectedVenueId = selectedVenue?.id;
  const selectedVenueName = selectedVenue?.name;

  useEffect(() => {
    if (selectedVenueName) {
      setSearchValue(selectedVenueName);
    }
  }, [selectedVenueId, selectedVenueName]);

  useEffect(() => {
    const keyword = deferredSearchValue.trim();
    const isCurrentSelectionKeyword = !!selectedVenue && keyword === selectedVenue.name.trim();

    if (!keyword || isCurrentSelectionKeyword) {
      setItems([]);
      setIsLoading(false);
      setSearchError('');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setSearchError('');

      try {
        const result = await searchVenues({ keyword, limit: 8 });
        if (!cancelled) {
          setItems(result.items);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setSearchError((err as Error).message || '球馆搜索失败，请重试');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredSearchValue, selectedVenue]);

  const showResults =
    deferredSearchValue.trim().length > 0 &&
    (!selectedVenue || deferredSearchValue.trim() !== selectedVenue.name.trim());

  return (
    <div>
      <input
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => {
          const nextValue = e.target.value;
          setSearchValue(nextValue);
          if (selectedVenue && nextValue !== selectedVenue.name) {
            onChangeSelection(null);
          }
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: error ? '1px solid #ff4d4f' : '1px solid #d9d9d9',
          borderRadius: 8,
          boxSizing: 'border-box',
        }}
      />

      {selectedVenue && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
          已选: {selectedVenue.name}
          {selectedVenue.address ? ` · ${selectedVenue.address}` : ''}
        </div>
      )}

      {!selectedVenue && helperText && (
        <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{helperText}</div>
      )}

      {showResults && (
        <div
          style={{
            marginTop: 8,
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {isLoading && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#999' }}>搜索中...</div>
          )}

          {!isLoading && searchError && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#ff4d4f' }}>
              {searchError}
            </div>
          )}

          {!isLoading && !searchError && items.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#999' }}>未找到匹配球馆</div>
          )}

          {!isLoading &&
            !searchError &&
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeSelection(item);
                  setSearchValue(item.name);
                  setItems([]);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderTop: '1px solid #f5f5f5',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 14, color: '#222' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {item.address || '地址待补充'}
                </div>
              </button>
            ))}
        </div>
      )}

      {error && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
