import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

// First-time message for Youssef
const YOUSSEF_FIRST_TIME_MESSAGE = "Dr. Ahmad! Remember all those FIFA nights? Well, I figured we needed something to balance out the couch time. I built this entire app just for us - to make sure we never miss our gym sessions despite your crazy doctor schedule and my coding marathons. Welcome to GymBuddy, brother! 🎮💪";

// Rotating messages for Youssef
const YOUSSEF_MESSAGES = [
  "Hey Youssef! Ready to crush today's workout? Let's show Adam what a strong dad looks like! 💪",
  "Dr. Ahmad checking in! Time to prescribe ourselves some gains today, brother! 💊",
  "Youssef! Cristina's going to be impressed when she sees the results. Let's make it happen! 🔥",
  "Hey bro! Less FIFA, more fitness today. Our controllers can wait, the weights can't! 🎮",
  "Morning, Dr. Ahmad! Time to trade the stethoscope for some dumbbells! 🏥💪",
  "Youssef! Let's make sure Adam's dad stays the strongest guy he knows! 👨‍👦",
  "Hey man! Another day, another opportunity to get stronger together! 🚀",
  "Dr. Ahmad! Your patients need you healthy too. Let's do this! 👨‍⚕️",
  "Youssef! Time to show those Mortal Kombat moves in real life! 🥊",
  "Hey brother! The gym is calling our names today. Let's answer! 📞💪",
  "Youssef! Even superheroes need workout partners. That's where I come in! 🦸‍♂️",
  "Dr. Ahmad! Let's turn coffee breaks into muscle breaks today! ☕💪",
  "Hey bro! FIFA can wait. Gains can't. You know what to do! 🎯",
  "Youssef! Time to make Cristina proud of her husband's dedication! 💝",
  "Morning champion! Let's add another great session to our streak! 🏆",
  "Dr. Ahmad! Healing others by day, building muscle by evening. Let's go! 🌟",
  "Hey man! Adam's counting on us to stay strong. No pressure! 😄",
  "Youssef! Our gym brotherhood awaits. Ready when you are! 👊",
  "Time to level up, Dr. Ahmad! Both in games and in gains! 🎮🏋️‍♂️"
];

// Motivational quotes for Ivan
const MOTIVATIONAL_QUOTES = [
  "The only bad workout is the one that didn't happen. 💪",
  "Your body can stand almost anything. It's your mind that you have to convince. 🧠",
  "Success isn't always about greatness. It's about consistency. 🎯",
  "The pain you feel today will be the strength you feel tomorrow. 🔥",
  "Don't stop when you're tired. Stop when you're done. 🏁",
  "Champions aren't made in the gyms. Champions are made from something they have deep inside them - a desire, a dream, a vision. 🏆",
  "The difference between the impossible and the possible lies in a person's determination. 💯",
  "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't. 💪",
  "Every workout is progress. Every rep counts. Every day matters. 📈",
  "Your health is an investment, not an expense. 💰",
  "The body achieves what the mind believes. 🧠💪",
  "Wake up with determination. Go to bed with satisfaction. 😴",
  "Train like a beast, look like a beauty. 🦁",
  "Sweat is just fat crying. 💦",
  "You don't have to be extreme, just consistent. 📅",
  "The gym is not just a place to lift weights, it's a place to lift yourself up. 🏋️‍♂️",
  "Make your body the sexiest outfit you own. 👔",
  "Exercise is a celebration of what your body can do, not a punishment for what you ate. 🎉",
  "The only competition that matters is the one with yourself yesterday. 📊",
  "Fall in love with taking care of yourself. ❤️"
];

interface WelcomeSplashProps {
  onComplete: () => void;
}

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const { user, profile } = useAuth();
  const [timeLeft, setTimeLeft] = useState(5);
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;

    const isYoussef = profile.email !== 'ivanaguilarmari@gmail.com';
    
    if (isYoussef) {
      // Check if it's Youssef's first visit
      const firstVisitKey = `gymbuddy_first_visit_${user.id}`;
      const hasVisitedBefore = localStorage.getItem(firstVisitKey);
      
      if (!hasVisitedBefore) {
        // First time - show welcome message
        setMessage(YOUSSEF_FIRST_TIME_MESSAGE);
        localStorage.setItem(firstVisitKey, 'true');
      } else {
        // Subsequent visits - show rotating message
        const randomIndex = Math.floor(Math.random() * YOUSSEF_MESSAGES.length);
        setMessage(YOUSSEF_MESSAGES[randomIndex]);
      }
    } else {
      // Ivan - show motivational quote
      const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
      setMessage(MOTIVATIONAL_QUOTES[randomIndex]);
    }
  }, [user, profile]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Start fade out animation
          setIsVisible(false);
          // Complete after animation
          setTimeout(onComplete, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  if (!message) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-4xl mx-auto px-8 text-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
            {message}
          </h1>
          
          <div className="mt-12">
            <div className="inline-flex items-center justify-center">
              <div className="relative w-20 h-20">
                <svg className="transform -rotate-90 w-20 h-20">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-700"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={226}
                    strokeDashoffset={226 - (226 * (5 - timeLeft)) / 5}
                    className="text-primary transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{timeLeft}</span>
                </div>
              </div>
            </div>
            
            <p className="text-gray-400 mt-4 text-sm">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}