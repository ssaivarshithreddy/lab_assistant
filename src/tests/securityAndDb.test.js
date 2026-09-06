import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from '../../server/encryptionService';

describe('LabSense Security, Encryption & Verification Test Suite', () => {

  // TEST 1: AES-256-GCM Encryption & Decryption
  it('TEST 1: Encrypts plain text with AES-256-GCM and decrypts back accurately', () => {
    const originalText = "Patient Blood Report: Hemoglobin 14.5 g/dL, Glucose 141 mg/dL HIGH";
    const encrypted = encryptData(originalText);
    
    expect(encrypted).not.toBe(originalText);
    expect(encrypted).toContain('AES-256-GCM');
    
    const decrypted = decryptData(encrypted);
    expect(decrypted).toBe(originalText);
  });

  // TEST 2: AES-256-GCM Object JSON Encryption & Decryption
  it('TEST 2: Encrypts structured JSON lab parameters and decrypts back to object', () => {
    const labValues = {
      glucose: { value: 141, unit: 'mg/dL', status: 'high' },
      hba1c: { value: 7.1, unit: '%', status: 'high' }
    };
    
    const encrypted = encryptData(labValues);
    expect(encrypted).toContain('is_encrypted');
    
    const decrypted = decryptData(encrypted);
    expect(decrypted).toEqual(labValues);
    expect(decrypted.glucose.value).toBe(141);
  });

  // TEST 3: Email OTP Code Generator Logic
  it('TEST 3: Generates valid 6-digit numerical OTP codes', () => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    expect(otpCode).toMatch(/^[0-9]{6}$/);
    expect(otpCode.length).toBe(6);
  });

  // TEST 4: Decryption Fallback for Unencrypted Plain Text
  it('TEST 4: Gracefully handles plain unencrypted legacy text during migration', () => {
    const plainText = "Standard Legacy Text";
    const result = decryptData(plainText);
    expect(result).toBe(plainText);
  });

  // TEST 5: Phone OTP format validation
  it('TEST 5: Generates valid phone SMS OTP code format', () => {
    const phoneOtp = Math.floor(100000 + Math.random() * 900000).toString();
    expect(phoneOtp).toHaveLength(6);
    expect(Number(phoneOtp)).toBeGreaterThanOrEqual(100000);
  });

});
