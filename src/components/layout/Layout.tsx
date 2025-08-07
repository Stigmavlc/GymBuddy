import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      // Clear the splash screen flag so it shows on next login
      sessionStorage.removeItem('gymbuddy_splash_shown');
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">
              💪 GymBuddy
            </h1>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => 
                  isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                }
              >
                Dashboard
              </NavLink>
              <NavLink 
                to="/availability" 
                className={({ isActive }) => 
                  isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                }
              >
                Availability
              </NavLink>
              <NavLink 
                to="/sessions" 
                className={({ isActive }) => 
                  isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                }
              >
                Sessions
              </NavLink>
              <NavLink 
                to="/settings" 
                className={({ isActive }) => 
                  isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                }
              >
                Settings
              </NavLink>
              <div className="flex items-center gap-2 ml-4">
                {profile && (
                  <span className="text-sm text-muted-foreground">
                    Welcome, {profile.name}
                  </span>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  Sign Out
                </Button>
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              {profile && (
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  Welcome, {profile.name}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t">
              <nav className="flex flex-col gap-2 pt-4">
                <NavLink 
                  to="/dashboard" 
                  className={({ isActive }) => 
                    `block px-3 py-2 rounded-md text-base font-medium ${
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </NavLink>
                <NavLink 
                  to="/availability" 
                  className={({ isActive }) => 
                    `block px-3 py-2 rounded-md text-base font-medium ${
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Availability
                </NavLink>
                <NavLink 
                  to="/sessions" 
                  className={({ isActive }) => 
                    `block px-3 py-2 rounded-md text-base font-medium ${
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sessions
                </NavLink>
                <NavLink 
                  to="/settings" 
                  className={({ isActive }) => 
                    `block px-3 py-2 rounded-md text-base font-medium ${
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Settings
                </NavLink>
                <div className="border-t mt-2 pt-2">
                  <button
                    onClick={handleSignOut}
                    className="block px-3 py-2 rounded-md text-base font-medium w-full text-left text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}