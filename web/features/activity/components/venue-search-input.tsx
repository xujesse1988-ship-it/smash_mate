import React, { useDeferredValue, useEffect, useState, useRef } from 'react';
import type { VenueSearchItem } from '../api/venue-api';
import { searchVenues } from '../api/venue-api';
import { useAuthStore } from '../../../stores/auth-store';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { getUserRecentVenues } from '../api/activity-api';

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

  const [isFocused, setIsFocused] = useState(false);
  const [recentVenues, setRecentVenues] = useState<VenueSearchItem[]>([]);
  const [closestVenues, setClosestVenues] = useState<VenueSearchItem[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const { userId } = useAuthStore();
  const geolocation = useGeolocation();

  const deferredSearchValue = useDeferredValue(searchValue);
  const selectedVenueId = selectedVenue?.id;
  const selectedVenueName = selectedVenue?.name;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const isKeywordEmpty = deferredSearchValue.trim().length === 0;
    if (isFocused && isKeywordEmpty && !selectedVenue) {
      let cancelled = false;

      const fetchRecommendations = async () => {
        setIsLoadingRecommendations(true);
        try {
          if (userId && recentVenues.length === 0) {
            try {
              const recent = await getUserRecentVenues(userId);
              if (!cancelled) setRecentVenues(recent.items);
            } catch (err) {
              console.error('Failed to fetch recent venues', err);
            }
          }
          if (geolocation.latitude && geolocation.longitude && closestVenues.length === 0) {
            try {
              const closest = await searchVenues({
                keyword: '',
                latitude: geolocation.latitude,
                longitude: geolocation.longitude,
                limit: 5,
              });
              if (!cancelled) setClosestVenues(closest.items);
            } catch (err) {
              console.error('Failed to fetch closest venues', err);
            }
          } else if (geolocation.permission === 'prompt') {
            geolocation.requestLocation();
          }
        } finally {
          if (!cancelled) setIsLoadingRecommendations(false);
        }
      };

      fetchRecommendations();

      return () => {
        cancelled = true;
      };
    }
  }, [
    isFocused,
    deferredSearchValue,
    selectedVenue,
    userId,
    geolocation.latitude,
    geolocation.longitude,
    geolocation.permission,
    geolocation.requestLocation,
    recentVenues.length,
    closestVenues.length,
  ]);

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

  const isSearching = deferredSearchValue.trim().length > 0;
  const isSelected = !!selectedVenue && deferredSearchValue.trim() === selectedVenue.name.trim();

  const showSearchResults = isSearching && !isSelected && isFocused;
  const showRecommendations = !isSearching && !isSelected && isFocused;
  const showDropdown = showSearchResults || showRecommendations;

  const renderVenueItem = (item: VenueSearchItem) => (
    <button
      key={item.id}
      type="button"
      onClick={() => {
        onChangeSelection(item);
        setSearchValue(item.name);
        setItems([]);
        setIsFocused(false);
      }}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        border: 'none',
        borderTop: '1px solid var(--surface-2)',
        background: 'var(--surface)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--text-1)' }}>{item.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
        {item.address || '地址待补充'}
      </div>
    </button>
  );

  return (
    <div ref={containerRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onFocus={() => setIsFocused(true)}
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
          border: error ? '1px solid var(--danger)' : '1px solid var(--surface-2)',
          borderRadius: 8,
          boxSizing: 'border-box',
          background: 'var(--surface)',
          color: 'var(--text-1)',
        }}
      />

      {selectedVenue && (
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
          已选: {selectedVenue.name}
          {selectedVenue.address ? ` · ${selectedVenue.address}` : ''}
        </div>
      )}

      {!selectedVenue && helperText && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{helperText}</div>
      )}

      {showDropdown && (
        <div
          style={{
            marginTop: 8,
            border: '1px solid var(--surface-2)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--surface)',
            maxHeight: 300,
            overflowY: 'auto'
          }}
        >
          {showSearchResults && (
            <>
              {isLoading && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-3)' }}>搜索中...</div>
              )}

              {!isLoading && searchError && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--danger)' }}>
                  {searchError}
                </div>
              )}

              {!isLoading && !searchError && items.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-3)' }}>未找到匹配球馆</div>
              )}

              {!isLoading && !searchError && items.map(renderVenueItem)}
            </>
          )}

          {showRecommendations && (
            <div style={{ padding: '8px 0' }}>
              {isLoadingRecommendations && (
                <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--text-3)' }}>加载推荐...</div>
              )}

              {!isLoadingRecommendations && recentVenues.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-2)', padding: '8px 12px 4px' }}>
                    曾经去过
                  </div>
                  {recentVenues.map(renderVenueItem)}
                </>
              )}

              {!isLoadingRecommendations && closestVenues.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-2)', padding: '8px 12px 4px', marginTop: recentVenues.length > 0 ? 8 : 0 }}>
                    离你最近
                  </div>
                  {closestVenues
                    .filter((c) => !recentVenues.find((r) => r.id === c.id))
                    .map(renderVenueItem)}
                </>
              )}

              {!isLoadingRecommendations && recentVenues.length === 0 && closestVenues.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-3)' }}>请输入球馆名称搜索</div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
