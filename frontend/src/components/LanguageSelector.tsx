import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  flag: string;
  speechCode?: string;
}

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // All supported languages with English and Indian languages prioritized
  const languages: Language[] = [
    // English variants (prioritized)
    { code: 'en', name: 'English', flag: '🇺🇸', speechCode: 'en-US' },
    
    // Indian languages (prioritized)
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', speechCode: 'hi-IN' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩', speechCode: 'bn-IN' },
    { code: 'ta', name: 'தமிழ்', flag: '🇮🇳', speechCode: 'ta-IN' },
    
    // Other languages
    { code: 'es', name: 'Español', flag: '🇪🇸', speechCode: 'es-ES' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', speechCode: 'fr-FR' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', speechCode: 'de-DE' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹', speechCode: 'it-IT' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱', speechCode: 'nl-NL' },
    { code: 'pt', name: 'Português', flag: '🇧🇷', speechCode: 'pt-BR' },
    { code: 'zh', name: '中文', flag: '🇨🇳', speechCode: 'zh-CN' },
    { code: 'ja', name: '日本語', flag: '🇯🇵', speechCode: 'ja-JP' },
    { code: 'ko', name: '한국어', flag: '🇰🇷', speechCode: 'ko-KR' },
    { code: 'hr', name: 'Hrvatski', flag: '🇭🇷', speechCode: 'hr-HR' },
    { code: 'sk', name: 'Slovenčina', flag: '🇸🇰', speechCode: 'sk-SK' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱', speechCode: 'pl-PL' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', speechCode: 'el-GR' },
  ];

  const selectedLang = languages.find(lang => lang.code === selectedLanguage) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageSelect = (languageCode: string) => {
    onLanguageChange(languageCode);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        <Globe className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {selectedLang.flag} {selectedLang.name}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          <div className="py-1">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageSelect(language.code)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors ${
                  selectedLanguage === language.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{language.flag}</span>
                  <span className="font-medium">{language.name}</span>
                  {selectedLanguage === language.code && (
                    <span className="ml-auto text-blue-600">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector; 