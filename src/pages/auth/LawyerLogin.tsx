import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scale, Lock, Mail, User, Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';

export const LawyerLogin: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enrolmentId, setEnrolmentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { loginLawyer, registerLawyer } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 10) {
          throw new Error('Password must be at least 10 characters long.');
        }
        await registerLawyer(name, email, password, enrolmentId);
      } else {
        await loginLawyer(email, password);
      }
      navigate('/lawyer/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
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
          {isRegister ? 'Register Counsel Account' : 'Counsel Portal Login'}
        </h2>
        <p className="mt-1 text-center text-xs text-[#5C5E66]">
          {isRegister
            ? 'Create an advocate profile to manage cases and evidence records'
            : 'Access your persistent case state and evidence workspace'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E4DFD3] rounded-md card-brass-top sm:px-10">
          {error && (
            <div className="mb-5 p-3 bg-[#FDF2F2] border border-[#F8B4B4] rounded text-xs text-[#9B2C2C] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#2B2D33] mb-1">
                    Advocate Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-[#5C5E66]" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Advocate A. Sharma"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2B2D33] mb-1">
                    Bar / Enrolment ID <span className="text-[#5C5E66] font-normal">(self-declared)</span>
                  </label>
                  <input
                    type="text"
                    value={enrolmentId}
                    onChange={e => setEnrolmentId(e.target.value)}
                    placeholder="e.g., D/1042/2019"
                    className="w-full px-3 py-2 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D] font-mono"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#2B2D33] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#5C5E66]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="lawyer@firm.legal"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2B2D33] mb-1">
                Password {isRegister && <span className="text-[#5C5E66] font-normal">(minimum 10 characters)</span>}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#5C5E66]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#14213D] hover:bg-[#1E2D4A] text-white text-xs font-medium rounded transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : isRegister ? 'Register & Open Workspace' : 'Sign In as Counsel'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E4DFD3] text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-[#B08D57] hover:underline font-medium"
            >
              {isRegister
                ? 'Already have an account? Sign in here'
                : 'Need to create a lawyer account? Register here'}
            </button>
          </div>

          <div className="mt-4 p-2.5 bg-[#FAF7F0] border border-[#E4DFD3] rounded text-[11px] text-[#5C5E66]">
            <strong>Demo Credentials (after loading demo case):</strong>
            <p className="font-mono mt-0.5 text-[#14213D]">lawyer@demo.caselens.legal / demoLawyer1234!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
