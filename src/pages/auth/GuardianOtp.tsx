import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scale, Mail, KeyRound, AlertCircle, ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { apiRequest } from '../../lib/api.js';

export const GuardianOtp: React.FC = () => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { verifyGuardianOtp } = useAuth();
  const navigate = useNavigate();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setDevCode(null);

    try {
      const res = await apiRequest<{
        success: boolean;
        mode: string;
        devCode?: string;
        message?: string;
      }>('/api/auth/guardian/otp/request', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim() })
      });

      setStatusMessage(res.message || 'Verification code sent.');
      if (res.devCode) {
        setDevCode(res.devCode);
        setCode(res.devCode); // Pre-fill in dev mode for testing convenience
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyGuardianOtp(identifier.trim(), code.trim());
      navigate('/guardian/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#2B2D33]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-2">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[#5C5E66] hover:text-[#14213D] mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to role selection</span>
          </Link>
        </div>

        <div className="flex justify-center">
          <div className="w-12 h-12 rounded bg-[#14213D] flex items-center justify-center text-[#B08D57]">
            <Scale className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center font-legal-heading text-2xl font-bold text-[#14213D]">
          Client & Guardian Access
        </h2>
        <p className="mt-1 text-center text-xs text-[#5C5E66]">
          One-time passcode (OTP) verification for linked client accounts
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E4DFD3] rounded-md card-brass-top sm:px-10">
          {/* Honest Dev Mode Banner */}
          {devCode && (
            <div className="mb-5 p-3 bg-[#FEFCE8] border border-[#FCE96A] rounded text-xs text-[#B7791F]">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <ShieldAlert className="w-4 h-4 text-[#B7791F]" />
                <span>Development Mode Notice</span>
              </div>
              <p>Development mode: no SMS/email was actually sent.</p>
              <p className="mt-1 font-mono font-bold text-sm text-[#14213D]">
                Verification Code: {devCode}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3 bg-[#FDF2F2] border border-[#F8B4B4] rounded text-xs text-[#9B2C2C] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'request' ? (
            <form className="space-y-4" onSubmit={handleRequestOtp}>
              <div>
                <label className="block text-xs font-medium text-[#2B2D33] mb-1">
                  Registered Email Address or Mobile Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#5C5E66]" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="guardian@demo.caselens.legal or +919876543210"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
                  />
                </div>
                <span className="block mt-1 text-[11px] text-[#5C5E66]">
                  Enter the email or phone number provided to your attorney.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#14213D] hover:bg-[#1E2D4A] text-white text-xs font-medium rounded transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Sending verification code...' : 'Request Verification Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-4 p-2.5 bg-[#FAF7F0] border border-[#E4DFD3] rounded text-[11px] text-[#5C5E66]">
                <strong>Demo Guardian Identifier:</strong>
                <p className="font-mono mt-0.5 text-[#14213D]">guardian@demo.caselens.legal</p>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleVerifyOtp}>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-[#2B2D33]">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('request');
                      setError(null);
                    }}
                    className="text-[11px] text-[#B08D57] hover:underline"
                  >
                    Change identifier
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-[#5C5E66]" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono tracking-widest border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
                  />
                </div>
                <span className="block mt-1 text-[11px] text-[#5C5E66]">
                  Code expires in 5 minutes.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 px-4 bg-[#14213D] hover:bg-[#1E2D4A] text-white text-xs font-medium rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code & Enter Portal'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
