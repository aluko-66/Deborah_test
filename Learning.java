public class Learning {
    public static void main(String[] args) {
        System.out.println("0 is " + (isPrime(0) ? "" : "NOT ") + "a prime number");
        System.out.println("1 is " + (isPrime(1) ? "" : "NOT ") + "a prime number");
        System.out.println("2 is " + (isPrime(2) ? "" : "NOT ") + "a prime number");
        System.out.println("3 is " + (isPrime(3) ? "" : "NOT ") + "a prime number");
        System.out.println("4 is " + (isPrime(4) ? "" : "NOT ") + "a prime number");
    }

    public static boolean isPrime(int wholeNumber) {
        if (wholeNumber <= 1) {
            return false;
        }
        if (wholeNumber == 2) {
            return true;
        }
        if (wholeNumber % 2 == 0) {
            return false;
        }

        for (int i = 3; i * i <= wholeNumber; i += 2) { 
            if (wholeNumber % i == 0) {
                return false;
            }
        }

        return true;
    }
}
